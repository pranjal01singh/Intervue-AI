const fs = require("fs")
const path = require("path")
const User = require("../models/User")
const Interview = require("../models/Interview")
const parseResumePdf = require("../utils/resumeParser")
const { generateInterviewPlan, generateFollowUpQuestion, evaluateInterview, pairQuestionAnswers, summarizeLiveMetrics } = require("../services/aiInterviewService")
const { createResumeEmbeddings, findRelevantResumeChunks } = require("../services/resumeEmbeddingService")

const uploadDir = process.env.VERCEL ? "/tmp/uploads/resumes" : path.resolve(__dirname, "../../uploads/resumes")

const ensureUploadDirExists = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
}

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a PDF resume file." })
    }

    const isPdf = req.file.mimetype === "application/pdf" || path.extname(req.file.originalname).toLowerCase() === ".pdf"
    if (!isPdf) {
      return res.status(400).json({ success: false, message: "Only PDF resume files are supported." })
    }

    ensureUploadDirExists()

    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    let parsedResume
    try {
      parsedResume = await parseResumePdf(req.file.buffer)
    } catch (error) {
      return res.status(400).json({ success: false, message: "Could not read the PDF resume. Please upload a valid, text-based PDF." })
    }

    let resumeEmbeddings = { chunks: [], model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001", embeddedAt: null }
    try {
      resumeEmbeddings = await createResumeEmbeddings(parsedResume.rawText)
    } catch (error) {
      console.error("Resume embedding generation failed:", error.message)
    }

    const userUploadDir = path.join(uploadDir, req.user._id.toString())
    if (!fs.existsSync(userUploadDir)) {
      fs.mkdirSync(userUploadDir, { recursive: true })
    }

    const safeOriginalName = path.basename(req.file.originalname).replace(/[^\w.\- ()]/g, "_")
    const uniqueName = `${Date.now()}-${safeOriginalName}`
    const filePath = path.join(userUploadDir, uniqueName)
    fs.writeFileSync(filePath, req.file.buffer)

    user.resumeUrl = `/uploads/resumes/${req.user._id}/${uniqueName}`
    user.resumeUploadedAt = new Date()
    user.resumeParsedData = parsedResume
    user.resumeEmbeddings = resumeEmbeddings
    await user.save()

    res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      resumeUrl: user.resumeUrl,
      parsedResume,
      embeddingChunks: resumeEmbeddings.chunks.length,
    })
  } catch (error) {
    next(error)
  }
}

const startInterview = async (req, res, next) => {
  try {
    const { trackId, trackTitle, mode, resumeUrl } = req.body

    if (!trackId || !trackTitle || !mode || !resumeUrl) {
      return res.status(400).json({ success: false, message: "Track, mode, and resume are required to start the interview." })
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    const relevantResumeChunks = await findRelevantResumeChunks({
      resumeEmbeddings: user.resumeEmbeddings,
      query: [
        trackTitle,
        mode,
        ...(user.resumeParsedData?.skills || []),
        ...(user.resumeParsedData?.projects || []).slice(0, 3),
      ].join(" "),
    })

    const interviewPlan = await generateInterviewPlan({
      mode,
      trackTitle,
      resumeParsedData: user.resumeParsedData || {},
      relevantResumeChunks,
    })

    const interview = await Interview.create({
      user: user._id,
      trackId,
      trackTitle,
      mode,
      resumeUrl,
      resumeUploadedAt: user.resumeUploadedAt || new Date(),
      resumeParsedData: user.resumeParsedData,
      detectedDomain: interviewPlan.domain,
      questions: interviewPlan.questions,
      questionSource: interviewPlan.source,
      relevantResumeChunks,
      status: "started",
      startedAt: new Date(),
    })

    res.status(201).json({
      success: true,
      message: "Interview started successfully",
      interview,
    })
  } catch (error) {
    next(error)
  }
}

const permissionAccess = async (req, res, next) => {
  try {
    // Simple endpoint to record that the client requested camera/microphone access.
    // For now we just acknowledge and return the received payload.
    const { camera, microphone } = req.body || {}

    res.status(200).json({ success: true, message: "Permissions recorded", camera: !!camera, microphone: !!microphone })
  } catch (error) {
    next(error)
  }
}

const createFollowUpQuestion = async (req, res, next) => {
  try {
    const { interviewId, questionIndex, answer } = req.body

    if (!interviewId || typeof questionIndex !== "number") {
      return res.status(400).json({ success: false, message: "interviewId and questionIndex are required" })
    }

    const interview = await Interview.findOne({ _id: interviewId, user: req.user._id })
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" })
    }

    const existingFollowUps = interview.questions.filter((question) => question.category === "follow-up").length
    if (existingFollowUps >= 3) {
      return res.status(200).json({ success: true, followUp: null, message: "Follow-up limit reached" })
    }

    const followUp = await generateFollowUpQuestion({ interview, questionIndex, answer })
    if (!followUp) {
      return res.status(200).json({ success: true, followUp: null })
    }

    interview.questions.splice(questionIndex + 1, 0, followUp)
    await interview.save()

    res.status(201).json({ success: true, followUp, questions: interview.questions })
  } catch (error) {
    next(error)
  }
}

const completeInterview = async (req, res, next) => {
  try {
    const { interviewId, answeredCount, durationSeconds, transcripts, visualMetrics, isCheat = false } = req.body

    if (!interviewId) {
      return res.status(400).json({ success: false, message: "interviewId is required" })
    }

    const interview = await Interview.findOne({ _id: interviewId, user: req.user._id })
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" })
    }

    try {
      interview.status = "completed"
      interview.completedAt = new Date()
      if (typeof durationSeconds === "number") interview.durationSeconds = durationSeconds
      if (Array.isArray(transcripts)) {
        interview.transcripts = transcripts.map((t) => ({
          speaker: t.speaker || "",
          text: t.text || "",
          timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
          questionIndex: typeof t.questionIndex === "number" ? t.questionIndex : undefined,
          questionText: t.questionText || "",
          interim: !!t.interim,
        }))
      } else {
        interview.transcripts = []
      }

      const answerAnalysis = pairQuestionAnswers(interview.questions || [], interview.transcripts || [])
      interview.answerAnalysis = answerAnalysis
      interview.liveMetrics = summarizeLiveMetrics(answerAnalysis)
      
      // Recalculate answeredCount from transcripts to ensure accuracy
      const answeredQuestions = answerAnalysis.filter((pair) => !pair.skipped).length
      interview.answeredCount = answeredQuestions
      
      if (visualMetrics && typeof visualMetrics === "object") {
        interview.visualMetrics = {
          eyeContactScore: visualMetrics.eyeContactScore || 0,
          attentionScore: visualMetrics.attentionScore || 0,
          faceDetectedRatio: visualMetrics.faceDetectedRatio || 0,
          lookingAwayCount: visualMetrics.lookingAwayCount || 0,
          totalSamples: visualMetrics.totalSamples || 0,
          questionMetrics: Array.isArray(visualMetrics.questionMetrics) ? visualMetrics.questionMetrics : [],
        }
      }

      await interview.save()

      const feedback = await evaluateInterview({
        interview,
        transcripts: interview.transcripts || [],
        isCheat: !!isCheat,
      })
      interview.feedback = {
        ...feedback,
        generatedAt: new Date(),
      }

      await interview.save()

      res.status(200).json({ success: true, message: "Interview completed", interview })
    } catch (analysisError) {
      console.error("Error during interview analysis:", analysisError.message, analysisError.stack)
      throw analysisError
    }
  } catch (error) {
    console.error("Interview completion error:", error.message, error.stack)
    next(error)
  }
}

const hasEmptyFeedbackScores = (feedback) => {
  if (!feedback?.scores) return true

  const scores = [
    feedback.overallScore,
    feedback.scores.communication,
    feedback.scores.confidence,
    feedback.scores.technicalSkills,
    feedback.scores.answerDepth,
    feedback.scores.eyeContact,
    feedback.scores.attention,
  ]

  return scores.every((score) => !score || Number(score) === 0)
}

const hasHighFeedbackWithoutAnswers = (interview) => {
  const answerAnalysis = pairQuestionAnswers(interview.questions || [], interview.transcripts || [])
  const answeredQuestions = answerAnalysis.filter((pair) => !pair.skipped).length
  if (answeredQuestions > 0) return false

  const scores = interview.feedback?.scores || {}
  return [interview.feedback?.overallScore, scores.communication, scores.confidence, scores.technicalSkills, scores.answerDepth]
    .some((score) => Number(score) > 0)
}

const repairInterviewFeedbackIfNeeded = async (interview) => {
  if (interview?.status !== "completed" || !interview?.completedAt || !interview?.feedback) return interview
  if (!hasEmptyFeedbackScores(interview.feedback) && !hasHighFeedbackWithoutAnswers(interview)) return interview

  try {
    const answerAnalysis = pairQuestionAnswers(interview.questions || [], interview.transcripts || [])
    interview.answerAnalysis = answerAnalysis
    interview.liveMetrics = summarizeLiveMetrics(answerAnalysis)
    interview.answeredCount = answerAnalysis.filter((pair) => !pair.skipped).length
    interview.status = "completed"
    if (!interview.completedAt) interview.completedAt = new Date()

    const feedback = await evaluateInterview({
      interview,
      transcripts: interview.transcripts || [],
      isCheat: !!interview.feedback?.isCheat,
    })
    interview.feedback = {
      ...feedback,
      generatedAt: new Date(),
    }
    await interview.save()
  } catch (error) {
    console.error("Error repairing interview feedback:", error.message)
  }

  return interview
}
const getInterviewById = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id })
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" })
    }

    await repairInterviewFeedbackIfNeeded(interview)

    res.status(200).json({ success: true, interview: interview.toObject() })
  } catch (error) {
    next(error)
  }
}

const getDerivedDurationSeconds = (interview) => {
  if (typeof interview.durationSeconds === "number" && interview.durationSeconds > 0) return interview.durationSeconds

  const startedAt = interview.startedAt ? new Date(interview.startedAt).getTime() : null
  const endedAt = interview.completedAt || interview.updatedAt ? new Date(interview.completedAt || interview.updatedAt).getTime() : null
  if (!startedAt || !endedAt || Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt <= startedAt) return 0

  return Math.round((endedAt - startedAt) / 1000)
}

const getDerivedAnsweredCount = (interview) => {
  if (typeof interview.answeredCount === "number" && interview.answeredCount > 0) return interview.answeredCount

  if (Array.isArray(interview.answerAnalysis) && interview.answerAnalysis.length) {
    return interview.answerAnalysis.filter((answer) => !answer.skipped).length
  }

  if (Array.isArray(interview.feedback?.questionBreakdown) && interview.feedback.questionBreakdown.length) {
    return interview.feedback.questionBreakdown.filter((item) => !item.skipped).length
  }

  if (Array.isArray(interview.transcripts) && interview.transcripts.length) {
    const answeredQuestions = new Set()
    interview.transcripts.forEach((item) => {
      const normalized = typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : ""
      const wordCount = normalized.split(/\s+/).filter(Boolean).length
      if (item.speaker === "user" && !item.interim && typeof item.questionIndex === "number" && normalized.length >= 30 && wordCount >= 8) {
        answeredQuestions.add(item.questionIndex)
      }
    })
    return answeredQuestions.size
  }

  return 0
}

const getDerivedOverallScore = (interview) => {
  if (typeof interview.feedback?.overallScore === "number" && interview.feedback.overallScore > 0) return interview.feedback.overallScore
  return null
}

const getInterviewHistory = async (req, res, next) => {
  try {
    const userId = req.user._id
    const interviewDocs = await Interview.find({
      user: userId,
      $or: [
        { status: "completed" },
        { completedAt: { $ne: null } },
        { "feedback.generatedAt": { $ne: null } },
      ],
    }).sort({ startedAt: -1 })

    await Promise.all(interviewDocs.map((interview) => repairInterviewFeedbackIfNeeded(interview)))

    const normalizedInterviews = interviewDocs.map((interviewDoc) => {
      const interview = interviewDoc.toObject()
      return {
      ...interview,
      durationSeconds: getDerivedDurationSeconds(interview),
      answeredCount: getDerivedAnsweredCount(interview),
      }
    })

    const totalInterviews = normalizedInterviews.length
    const totalTimeSeconds = normalizedInterviews.reduce((sum, it) => sum + (it.durationSeconds || 0), 0)
    const avgAnswered = normalizedInterviews.length ? Math.round(normalizedInterviews.reduce((s, it) => s + (it.answeredCount || 0), 0) / normalizedInterviews.length) : 0
    const scoredInterviews = normalizedInterviews
      .map(getDerivedOverallScore)
      .filter((score) => typeof score === "number")
    const bestScore = scoredInterviews.length ? Math.max(...scoredInterviews) : null

    res.status(200).json({ success: true, interviews: normalizedInterviews, stats: { totalInterviews, totalTimeSeconds, avgAnswered, bestScore } })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  uploadResume,
  startInterview,
  permissionAccess,
  createFollowUpQuestion,
  completeInterview,
  getInterviewById,
  getInterviewHistory,
}
