const QUESTION_COUNTS = {
  easy: 9,
  medium: 13,
  hard: 18,
}

const DOMAIN_RULES = [
  { domain: "AI / ML Engineer", keywords: ["machine learning", "deep learning", "nlp", "llm", "rag", "embedding", "tensorflow", "pytorch", "scikit", "pandas", "numpy", "gemini", "openai"] },
  { domain: "Full Stack Developer", keywords: ["react", "node", "express", "mongodb", "mongoose", "rest api", "jwt", "frontend", "backend", "full stack"] },
  { domain: "Frontend Developer", keywords: ["react", "redux", "next.js", "html", "css", "tailwind", "typescript", "frontend", "ui"] },
  { domain: "Backend Developer", keywords: ["node", "express", "api", "mongodb", "postgresql", "mysql", "microservices", "database", "backend"] },
  { domain: "Data Analyst", keywords: ["sql", "power bi", "tableau", "excel", "dashboard", "analytics", "pandas", "data analyst"] },
  { domain: "DevOps Engineer", keywords: ["docker", "kubernetes", "ci/cd", "aws", "azure", "linux", "terraform", "devops"] },
]

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
const FILLER_WORDS = ["um", "uh", "like", "actually", "basically", "maybe", "i think", "sort of", "kind of"]

const extractJson = (text) => {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  }
}

const getGeminiResponseText = (data) =>
  (data?.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim()

const toGeminiPrompt = (input) => {
  const systemText = input
    .filter((item) => item.role === "developer")
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim()

  const userText = input
    .filter((item) => item.role !== "developer")
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim()

  return { systemText, userText }
}

const GEMINI_MODEL_REPLACEMENTS = {
  "gemini-3-flash-preview": "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash": "gemini-3.1-flash-lite",
  "gemini-2.0-flash": "gemini-3.1-flash-lite",
}

const geminiUnavailableUntilByModel = new Map()
const geminiDisabledModels = new Set()

const getGeminiModels = () => {
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)

  return Array.from(new Set([primaryModel, ...fallbackModels]
    .map((model) => GEMINI_MODEL_REPLACEMENTS[model] || model)
    .filter((model) => !geminiDisabledModels.has(model))))
}

const parseGeminiError = (message) => {
  try {
    return JSON.parse(message)?.error || null
  } catch {
    return null
  }
}

const getRetryDelayFromGeminiError = (error) => {
  const retryInfo = error?.details?.find((detail) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo")
  const retryDelay = retryInfo?.retryDelay
  const seconds = retryDelay ? Number(String(retryDelay).replace("s", "")) : 0

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 0
}

const isQuotaExhausted = (statusCode, error) =>
  statusCode === 429 && (
    error?.status === "RESOURCE_EXHAUSTED" ||
    error?.details?.some((detail) => detail["@type"] === "type.googleapis.com/google.rpc.QuotaFailure")
  )

const isModelUnavailableToProject = (statusCode, error) =>
  statusCode === 404 || /no longer available|not found/i.test(error?.message || "")

const markModelQuotaLimited = (model, error) => {
  const retryDelayMs = getRetryDelayFromGeminiError(error) || 60 * 1000
  const unavailableUntil = Date.now() + retryDelayMs
  geminiUnavailableUntilByModel.set(model, unavailableUntil)
  console.warn(`Gemini model ${model} quota exhausted. Skipping Gemini calls for this model for ${Math.ceil(retryDelayMs / 1000)}s and using local fallback when needed.`)
}

const getRetryDelayMs = ({ retryDelay, attempt, response }) => {
  const retryAfterSeconds = Number(response?.headers?.get("retry-after"))
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) return retryAfterSeconds * 1000

  const jitter = Math.floor(Math.random() * 350)
  return retryDelay * Math.pow(2, attempt) + jitter
}

const callGemini = async (input, retries = 2, retryDelay = 1200) => {
  if (!process.env.GEMINI_API_KEY) return null

  const models = getGeminiModels().filter((model) => {
    const unavailableUntil = geminiUnavailableUntilByModel.get(model) || 0
    return unavailableUntil <= Date.now()
  })
  if (!models.length) return null

  const { systemText, userText } = toGeminiPrompt(input)

  for (const model of models) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      let timeoutId

      try {
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 45000)

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemText }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userText }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json",
            },
          }),
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const statusCode = response.status
          const message = await response.text()
          const geminiError = parseGeminiError(message)

          if (isModelUnavailableToProject(statusCode, geminiError)) {
            geminiDisabledModels.add(model)
            console.warn(`Gemini model ${model} is not available for this API project. It will be skipped until the server restarts.`)
            break
          }

          if (isQuotaExhausted(statusCode, geminiError)) {
            markModelQuotaLimited(model, geminiError)
            break
          }

          const canRetrySameModel = (statusCode === 503 || statusCode === 429) && attempt < retries - 1

          if (canRetrySameModel) {
            const delayMs = getRetryDelayMs({ retryDelay, attempt, response })
            console.warn(`Gemini model ${model} returned ${statusCode}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`)
            await new Promise((resolve) => setTimeout(resolve, delayMs))
            continue
          }

          console.warn(`Gemini model ${model} unavailable (${statusCode}). ${models.at(-1) === model ? "Using local fallback." : "Trying fallback model."} ${message}`)
          break
        }

        return getGeminiResponseText(await response.json())
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)

        if (attempt < retries - 1) {
          const delayMs = getRetryDelayMs({ retryDelay, attempt })
          console.warn(`Gemini model ${model} error: ${error.message}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${retries})`)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }

        console.warn(`Gemini model ${model} failed: ${error.message}. ${models.at(-1) === model ? "Using local fallback." : "Trying fallback model."}`)
      }
    }
  }

  return null
}

const inferDomain = (resumeParsedData = {}, trackTitle = "") => {
  const text = [
    trackTitle,
    ...(resumeParsedData.skills || []),
    ...(resumeParsedData.projects || []),
    resumeParsedData.importantDetails?.summary || "",
    ...(resumeParsedData.importantDetails?.experience || []),
  ]
    .join(" ")
    .toLowerCase()

  const ranked = DOMAIN_RULES.map((rule) => ({
    domain: rule.domain,
    score: rule.keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)

  return ranked[0]?.score ? ranked[0].domain : trackTitle || "Software Developer"
}

const makeQuestion = (text, category, difficulty) => ({ text, category, difficulty })

const fallbackQuestions = ({ mode, trackTitle, resumeParsedData }) => {
  const domain = inferDomain(resumeParsedData, trackTitle)
  const skills = (resumeParsedData.skills || []).slice(0, 6)
  const projects = (resumeParsedData.projects || []).slice(0, 3)
  const mainSkill = skills[0] || domain
  const project = projects[0] || "your most important project"
  const difficulty = mode || "medium"
  const targetCount = QUESTION_COUNTS[difficulty] || QUESTION_COUNTS.medium

  const questionBank = [
    makeQuestion("Please introduce yourself briefly, mentioning your experience, main skills, and the kind of role you are targeting.", "intro", difficulty),
    makeQuestion(`In your resume, you mentioned ${mainSkill}. Explain one real use case where you applied it.`, "resume", difficulty),
    makeQuestion(`Walk me through ${project}. What problem did it solve and what was your exact contribution?`, "resume", difficulty),
    makeQuestion(`Which skill from your resume are you strongest in, and how would you prove that in a production project?`, "resume", difficulty),
    makeQuestion(`For a ${domain} role, explain the fundamentals you think are most important.`, "external", difficulty),
    makeQuestion(`What are common mistakes a ${domain} should avoid while building production systems?`, "external", difficulty),
    makeQuestion("Tell me about a time you were stuck technically. How did you debug and move forward?", "communication", difficulty),
    makeQuestion("If your interviewer challenges your design decision, how would you respond?", "communication", difficulty),
    makeQuestion("Describe a situation where you had to learn a new technology quickly.", "communication", difficulty),
  ]

  if (difficulty !== "easy") {
    questionBank.push(
      makeQuestion(`How would you scale one of your resume projects for 10x more users?`, "resume", difficulty),
      makeQuestion(`Design a reliable architecture for a ${domain} product. Include database, APIs, and failure handling.`, "external", difficulty),
      makeQuestion("Explain a tradeoff you made in a project and what you would improve now.", "communication", difficulty),
      makeQuestion(`Pick two skills from your resume: ${skills.slice(0, 2).join(" and ") || "your strongest skills"}. How do they work together?`, "resume", difficulty)
    )
  }

  if (difficulty === "hard") {
    questionBank.push(
      makeQuestion(`Deep dive into edge cases, performance, and security for ${project}.`, "resume", difficulty),
      makeQuestion(`How would you evaluate and monitor quality in a ${domain} system after deployment?`, "external", difficulty),
      makeQuestion("You disagree with a senior engineer during an urgent release. What do you do?", "communication", difficulty),
      makeQuestion(`Explain the hardest technical concept in your resume in a way a non-technical stakeholder can understand.`, "communication", difficulty),
      makeQuestion(`What would break first in your architecture, and how would you redesign it?`, "external", difficulty)
    )
  }

  return {
    domain,
    questions: questionBank.slice(0, targetCount),
    source: "fallback",
  }
}

const buildQuestionPrompt = ({ mode, trackTitle, resumeParsedData, relevantResumeChunks = [] }) => {
  const targetCount = QUESTION_COUNTS[mode] || QUESTION_COUNTS.medium

  return [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: "You are a strict technical interviewer. Return only valid JSON. First question must always be an introduction question. Questions must be personalized to resume, inferred domain, selected difficulty, and interview track.",
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify({
            task: "Generate interview questions",
            outputShape: {
              domain: "inferred user domain, e.g. Full Stack Developer, AI / ML Engineer, Frontend Developer",
              questions: [{ text: "question text", category: "intro|resume|external|communication", difficulty: "easy|medium|hard" }],
            },
            rules: [
              `Generate exactly ${targetCount} questions.`,
              "Question 1 category must be intro.",
              "After intro, include resume/skills/project questions, external domain questions, and communication/situation questions.",
              "Do not ask duplicate questions.",
              "Use simple interview-friendly English.",
            ],
            mode,
            selectedTrack: trackTitle,
            resume: {
              skills: resumeParsedData.skills || [],
              projects: resumeParsedData.projects || [],
              importantDetails: resumeParsedData.importantDetails || {},
              relevantChunksFromEmbeddingSearch: relevantResumeChunks,
              rawTextPreview: (resumeParsedData.rawText || "").slice(0, 4000),
            },
          }),
        },
      ],
    },
  ]
}

const normalizeQuestions = (questions = [], mode = "medium") =>
  questions
    .filter((question) => question?.text)
    .map((question, index) => ({
      text: String(question.text).trim(),
      category: index === 0 ? "intro" : question.category || "external",
      difficulty: question.difficulty || mode,
    }))

const buildFollowUpPrompt = ({ interview, question, answer }) => [
  {
    role: "developer",
    content: [
      {
        type: "input_text",
        text: "You are a live technical interviewer. Return only valid JSON. Create one short follow-up only when it will meaningfully test depth, clarify a vague answer, or connect the answer to resume/domain context.",
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "input_text",
        text: JSON.stringify({
          task: "Decide whether to ask a follow-up question",
          outputShape: {
            shouldAsk: true,
            question: "one concise follow-up question",
          },
          rules: [
            "Do not generate follow-up for intro questions.",
            "Do not ask if answer is empty or clearly skipped.",
            "Ask maximum one follow-up.",
            "Follow-up must be specific to candidate answer, resume, or domain.",
          ],
          interview: {
            domain: interview.detectedDomain,
            mode: interview.mode,
            trackTitle: interview.trackTitle,
            resumeSkills: interview.resumeParsedData?.skills || [],
            resumeProjects: interview.resumeParsedData?.projects || [],
          },
          currentQuestion: question,
          candidateAnswer: answer,
        }),
      },
    ],
  },
]

const shouldFallbackFollowUp = ({ question, answer }) => {
  const text = (answer || "").trim()
  if (!text || text.length < 40 || question?.category === "intro" || question?.category === "follow-up") return false
  return true
}

const generateFollowUpQuestion = async ({ interview, questionIndex, answer }) => {
  const question = interview.questions?.[questionIndex]
  if (!question || !shouldFallbackFollowUp({ question, answer })) return null

  const fallbackQuestion = {
    text: `Can you go deeper on your answer to "${question.text}" and explain one concrete tradeoff or implementation detail?`,
    category: "follow-up",
    difficulty: interview.mode || question.difficulty || "medium",
  }

  if (!process.env.GEMINI_API_KEY) return fallbackQuestion

  try {
    const aiText = await callGemini(buildFollowUpPrompt({ interview, question, answer }))
    const parsed = extractJson(aiText)
    if (!parsed?.shouldAsk || !parsed?.question) return null

    return {
      text: String(parsed.question).trim(),
      category: "follow-up",
      difficulty: interview.mode || question.difficulty || "medium",
    }
  } catch (error) {
    console.error("AI follow-up generation failed:", error.message)
    return fallbackQuestion
  }
}

const generateInterviewPlan = async ({ mode, trackTitle, resumeParsedData, relevantResumeChunks = [] }) => {
  const fallback = fallbackQuestions({ mode, trackTitle, resumeParsedData })

  try {
    const aiText = await callGemini(buildQuestionPrompt({ mode, trackTitle, resumeParsedData, relevantResumeChunks }))
    const parsed = extractJson(aiText)
    const questions = normalizeQuestions(parsed?.questions, mode)
    const targetCount = QUESTION_COUNTS[mode] || QUESTION_COUNTS.medium

    if (questions.length < 4) return fallback

    return {
      domain: parsed.domain || fallback.domain,
      questions: questions.slice(0, targetCount),
      source: "gemini",
    }
  } catch (error) {
    console.error("AI question generation failed:", error.message)
    console.log("Using fallback questions due to API unavailability or error")
    return fallback
  }
}

const countFillerWords = (text = "") => {
  const normalized = text.toLowerCase()
  return FILLER_WORDS.reduce((count, filler) => {
    const matches = normalized.match(new RegExp(`\\b${filler.replace(" ", "\\s+")}\\b`, "g"))
    return count + (matches?.length || 0)
  }, 0)
}

const scoreAnswerConfidence = ({ answer, fillerCount, responseSeconds }) => {
  const wordCount = answer.split(/\s+/).filter(Boolean).length
  const lengthScore = Math.min(35, wordCount * 1.4)
  const fillerPenalty = Math.min(20, fillerCount * 4)
  const delayPenalty = responseSeconds > 45 ? 10 : responseSeconds > 25 ? 5 : 0

  return clampScore(45 + lengthScore - fillerPenalty - delayPenalty)
}

const countWords = (text = "") => text.split(/\s+/).filter(Boolean).length

const isMeaningfulAnswer = (answer = "") => {
  const normalized = answer.replace(/\s+/g, " ").trim()
  return normalized.length >= 30 && countWords(normalized) >= 8
}

const pairQuestionAnswers = (questions = [], transcripts = []) => {
  const pairs = []
  let currentQuestion = null
  let currentAnswer = []
  let questionStartedAt = null

  if (!Array.isArray(transcripts)) return pairs
  if (!Array.isArray(questions)) return pairs

  transcripts.forEach((entry) => {
    if (!entry) return

    if (entry.speaker === "ai") {
      if (currentQuestion) {
        const answer = currentAnswer.map((item) => (item && item.text ? item.text : "")).join(" ").trim()
        const firstAnswerAt = currentAnswer[0]?.timestamp
        const responseSeconds = firstAnswerAt && questionStartedAt ? Math.max(0, Math.round((new Date(firstAnswerAt) - new Date(questionStartedAt)) / 1000)) : null
        if (currentQuestion.text) {
          pairs.push({
            question: currentQuestion.text || currentQuestion,
            questionIndex: currentQuestion.questionIndex,
            category: currentQuestion.category || "unknown",
            answer,
            responseSeconds,
          })
        }
      }

      const matched =
        typeof entry.questionIndex === "number" && entry.questionIndex >= 0
          ? questions[entry.questionIndex]
          : questions.find((question) => question && question.text === entry.text)
      if (!matched) {
        currentQuestion = null
        currentAnswer = []
        questionStartedAt = null
        return
      }

      currentQuestion = { ...matched, questionIndex: typeof entry.questionIndex === "number" ? entry.questionIndex : questions.indexOf(matched) }
      currentAnswer = []
      questionStartedAt = entry.timestamp || null
      return
    }

    if (entry.speaker === "user" && currentQuestion) {
      if (typeof entry.questionIndex === "number" && entry.questionIndex !== currentQuestion.questionIndex) return
      currentAnswer.push({ text: entry.text || "", timestamp: entry.timestamp })
    }
  })

  if (currentQuestion && currentQuestion.text) {
    const answer = currentAnswer.map((item) => (item && item.text ? item.text : "")).join(" ").trim()
    const firstAnswerAt = currentAnswer[0]?.timestamp
    const responseSeconds = firstAnswerAt && questionStartedAt ? Math.max(0, Math.round((new Date(firstAnswerAt) - new Date(questionStartedAt)) / 1000)) : null
    pairs.push({
      question: currentQuestion.text || currentQuestion,
      questionIndex: currentQuestion.questionIndex,
      category: currentQuestion.category || "unknown",
      answer,
      responseSeconds,
    })
  }

  return pairs.filter((pair) => pair && pair.question).map((pair) => {
    if (!pair) return null
    const fillerCount = countFillerWords(pair.answer || "")
    const wordCount = countWords(pair.answer || "")

    return {
      ...pair,
      wordCount,
      fillerCount,
      confidenceScore: scoreAnswerConfidence({ answer: pair.answer || "", fillerCount, responseSeconds: pair.responseSeconds }),
      skipped: !isMeaningfulAnswer(pair.answer || ""),
    }
  }).filter(p => p !== null)
}

const summarizeLiveMetrics = (pairs = []) => {
  const answered = pairs.filter((pair) => !pair.skipped)
  const avgConfidence = answered.length ? answered.reduce((sum, pair) => sum + pair.confidenceScore, 0) / answered.length : 0
  const responseTimes = answered.map((pair) => pair.responseSeconds).filter((value) => typeof value === "number")
  const avgResponseSeconds = responseTimes.length ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length : null

  return {
    confidence: clampScore(avgConfidence),
    avgResponseSeconds,
    fillerWords: answered.reduce((sum, pair) => sum + pair.fillerCount, 0),
    answeredQuestions: answered.length,
  }
}

const fallbackFeedback = ({ questions, transcripts, domain, visualMetrics, isCheat = false }) => {
  const pairs = pairQuestionAnswers(questions, transcripts)
  const answered = pairs.filter((pair) => !pair.skipped)
  const answeredCount = answered.length
  const avgAnswerLength = answeredCount ? answered.reduce((sum, pair) => sum + pair.answer.length, 0) / answeredCount : 0
  const liveMetrics = summarizeLiveMetrics(pairs)

  let communication = 0, technical = 0, confidence = 0, answerDepth = 0

  if (isCheat) {
    // Cheat feedback - very low scores across the board
    communication = 15
    technical = 10
    confidence = 12
    answerDepth = 8
  } else if (answeredCount === 0) {
    // No meaningful answers means no interview-performance credit.
    communication = 0
    technical = 0
    confidence = 0
    answerDepth = 0
  } else {
    // Normal scoring for answered questions
    communication = clampScore(avgAnswerLength > 250 ? 78 : avgAnswerLength > 120 ? 68 : 52)
    technical = clampScore(60 + Math.min(25, answeredCount * 2))
    confidence = typeof liveMetrics?.confidence === "number" ? clampScore(liveMetrics.confidence) : clampScore(avgAnswerLength > 180 ? 72 : 58)
    answerDepth = clampScore(avgAnswerLength > 300 ? 80 : avgAnswerLength > 150 ? 66 : 48)
  }

  // Ensure all scores are clamped and not undefined
  communication = clampScore(communication)
  technical = clampScore(technical)
  confidence = clampScore(confidence)
  answerDepth = clampScore(answerDepth)

  const eyeContact = clampScore(visualMetrics?.eyeContactScore || 0)
  const attention = clampScore(visualMetrics?.attentionScore || 0)
  const visualScores = [eyeContact, attention].filter((score) => score > 0)
  const scoreCount = visualScores.length > 0 ? 6 : 4
  const overall = answeredCount === 0 && !isCheat
    ? 0
    : clampScore((communication + technical + confidence + answerDepth + visualScores.reduce((sum, value) => sum + value, 0)) / scoreCount)

  const strengths = isCheat
    ? [{ title: "Note", text: "This interview was ended after repeated very low eye-contact and attention warnings during the session." }]
    : answeredCount === 0
      ? [{ title: "No answer evidence", text: "No meaningful spoken answers were recorded, so resume details were not used for performance scoring." }]
    : [
        { title: "Resume alignment", text: `You connected your answers with your ${domain || "target"} profile.` },
        ...(answeredCount > 0
          ? [{ title: "Interview completion", text: `You attempted ${answeredCount} meaningful answers during the session.` }]
          : [{ title: "Interview completion", text: "No substantive answers were recorded during this session. Make sure to speak clearly into your microphone." }]),
        ...(eyeContact > 0 ? [{ title: "Camera presence", text: `Your estimated eye-contact score was ${eyeContact}/100 based on face position and gaze approximation.` }] : []),
      ]

  const improvementAreas = isCheat
    ? [
        { title: "Maintain focus", text: "Avoid looking away from the camera during the interview." },
        { title: "Speak clearly", text: "Ensure your microphone is working and speak loud enough to be recorded." },
        { title: "Be honest", text: "Answer questions genuinely to get accurate feedback on your performance." },
      ]
    : answeredCount === 0
      ? [
          { title: "Answer the questions", text: "No meaningful answers were captured. Speak a complete response for each question so the evaluator can score your communication, confidence, technical skill, and answer depth." },
          { title: "Check microphone input", text: "If you did answer, make sure the browser has microphone permission and your speech is visible in the live transcript." },
        ]
    : [
        { title: "Add more depth", text: "Use Situation, Task, Action, Result structure and include exact tech decisions." },
        { title: "Be more specific", text: "Mention metrics, tradeoffs, edge cases, and production impact where possible." },
        ...(eyeContact < 60 ? [{ title: "Improve eye contact", text: "Keep your face centered and look toward the camera while answering." }] : []),
      ]

  return {
    overallScore: overall,
    scores: {
      communication,
      confidence,
      technicalSkills: technical,
      answerDepth,
      eyeContact,
      attention,
    },
    strengths,
    improvementAreas,
    questionBreakdown: pairs.map((pair) => ({
      question: pair.question,
      feedback: pair.skipped ? "Skipped or no meaningful answer detected." : "Answer recorded. Add examples, tradeoffs, and measurable impact to make it stronger.",
      score: pair.skipped ? 0 : clampScore((pair.confidenceScore + Math.min(85, 45 + pair.answer.length / 12)) / 2),
      skipped: pair.skipped,
    })),
    isCheat,
    source: "fallback",
  }
}

const buildFeedbackPrompt = ({ interview, transcripts }) => {
  try {
    const answerAnalysis = Array.isArray(interview?.answerAnalysis)
      ? interview.answerAnalysis
      : pairQuestionAnswers(interview?.questions || [], transcripts || [])
    const meaningfulAnswers = answerAnalysis.filter((item) => !item.skipped)
    const promptData = {
      task: "Evaluate mock interview answers using only the recorded user answers.",
      rules: [
        "Do not score from resume/profile/projects/skills. Resume context may explain the target role only, not performance.",
        "Communication, confidence, technicalSkills, and answerDepth must be based only on userAnswer text.",
        "If meaningfulAnswerCount is 0, overallScore and all non-visual scores must be 0.",
        "For any skipped question, questionBreakdown score must be 0 and skipped must be true.",
        "Do not invent answers or infer knowledge from the question text.",
      ],
      outputShape: {
        overallScore: 0,
        scores: { communication: 0, confidence: 0, technicalSkills: 0, answerDepth: 0, eyeContact: 0, attention: 0 },
        strengths: [{ title: "", text: "" }],
        improvementAreas: [{ title: "", text: "" }],
        questionBreakdown: [{ question: "", feedback: "", score: 0, skipped: false }],
      },
      interview: {
        domain: interview?.detectedDomain || "",
        mode: interview?.mode || "",
        trackTitle: interview?.trackTitle || "",
        meaningfulAnswerCount: meaningfulAnswers.length,
        answerAnalysis: answerAnalysis.map((item) => ({
          question: item?.question || "",
          questionIndex: item?.questionIndex,
          category: item?.category || "",
          userAnswer: item?.answer || "",
          wordCount: item?.wordCount || 0,
          skipped: !!item?.skipped,
        })),
        liveMetrics: interview?.liveMetrics || {},
        visualMetrics: interview?.visualMetrics || {},
      },
    }
    
    return [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: "You are an interview evaluator. Return only valid JSON. Score only the candidate's recorded answers. Never give performance credit from resume data, profile data, question wording, or target role. If an answer is skipped or empty, score that question 0.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(promptData),
          },
        ],
      },
    ]
  } catch (error) {
    console.error("Error building feedback prompt:", error.message)
    return [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: "You are an interview evaluator. Return only valid JSON.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ task: "Evaluate interview", domain: "Unknown", questions: [], answerAnalysis: [] }),
          },
        ],
      },
    ]
  }
}

const normalizeFeedback = (feedback, fallback) => {
  const hasNoMeaningfulAnswers = (fallback?.questionBreakdown || []).every((item) => item.skipped || !item.score)

  if (hasNoMeaningfulAnswers) {
    return {
      ...fallback,
      source: feedback?.source || fallback.source || "gemini-guarded",
    }
  }

  const useFallbackForEmptyScore = (score, fallbackScore) => {
    const normalized = clampScore(score)
    const normalizedFallback = clampScore(fallbackScore)

    if (normalized === 0 && normalizedFallback > 0) return normalizedFallback
    return normalized
  }

  // Ensure all scores exist and are properly set
  const normalizedScores = {
    communication: useFallbackForEmptyScore(feedback?.scores?.communication, fallback.scores?.communication),
    confidence: useFallbackForEmptyScore(feedback?.scores?.confidence, fallback.scores?.confidence),
    technicalSkills: useFallbackForEmptyScore(feedback?.scores?.technicalSkills, fallback.scores?.technicalSkills),
    answerDepth: useFallbackForEmptyScore(feedback?.scores?.answerDepth, fallback.scores?.answerDepth),
    eyeContact: useFallbackForEmptyScore(feedback?.scores?.eyeContact, fallback.scores?.eyeContact),
    attention: useFallbackForEmptyScore(feedback?.scores?.attention, fallback.scores?.attention),
  }
  
  // Recalculate overall score from components if not provided
  let overallScore = clampScore(feedback?.overallScore ?? fallback?.overallScore)
  if (!overallScore || overallScore === 0) {
    const visualScores = [normalizedScores.eyeContact, normalizedScores.attention].filter((score) => score > 0)
    const scoreCount = visualScores.length > 0 ? 6 : 4
    const sum = normalizedScores.communication + normalizedScores.confidence + normalizedScores.technicalSkills + normalizedScores.answerDepth + visualScores.reduce((a, b) => a + b, 0)
    overallScore = clampScore(sum / scoreCount)
  }

  const fallbackBreakdown = fallback.questionBreakdown || []
  const normalizedBreakdown = fallbackBreakdown.map((fallbackItem, index) => {
    const aiItem = Array.isArray(feedback?.questionBreakdown) ? feedback.questionBreakdown[index] : null
    if (fallbackItem.skipped) {
      return {
        ...fallbackItem,
        feedback: aiItem?.feedback && /skip|no answer|not answered|empty/i.test(aiItem.feedback)
          ? aiItem.feedback
          : fallbackItem.feedback,
        score: 0,
        skipped: true,
      }
    }

    return {
      ...fallbackItem,
      ...(aiItem && typeof aiItem === "object" ? aiItem : {}),
      question: fallbackItem.question,
      score: clampScore(aiItem?.score ?? fallbackItem.score),
      skipped: false,
    }
  })

  return {
    overallScore,
    scores: normalizedScores,
    strengths: Array.isArray(feedback?.strengths) && feedback.strengths.length ? feedback.strengths.slice(0, 5) : fallback.strengths,
    improvementAreas: Array.isArray(feedback?.improvementAreas) && feedback.improvementAreas.length ? feedback.improvementAreas.slice(0, 5) : fallback.improvementAreas,
    questionBreakdown: normalizedBreakdown.length ? normalizedBreakdown : fallback.questionBreakdown,
    isCheat: feedback?.isCheat ?? fallback.isCheat ?? false,
    source: feedback?.source || "gemini",
  }
}

const evaluateInterview = async ({ interview, transcripts, isCheat = false }) => {
  const fallback = fallbackFeedback({ questions: interview.questions, transcripts, domain: interview.detectedDomain, visualMetrics: interview.visualMetrics, isCheat })

  try {
    const aiText = await callGemini(buildFeedbackPrompt({ interview, transcripts }))
    const parsed = extractJson(aiText)
    if (!parsed) return fallback
    return normalizeFeedback(parsed, fallback)
  } catch (error) {
    console.error("AI feedback generation failed:", error.message)
    return fallback
  }
}

module.exports = {
  generateInterviewPlan,
  generateFollowUpQuestion,
  evaluateInterview,
  inferDomain,
  pairQuestionAnswers,
  summarizeLiveMetrics,
}
