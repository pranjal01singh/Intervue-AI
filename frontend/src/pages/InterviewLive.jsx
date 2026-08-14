import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"
import { useAuth } from "../context/useAuth"
import { sendMediaPermission, requestFollowUpQuestion, endInterviewWithTranscripts, cacheCompletedInterview } from "../services/interviewService"

const modes = {
  easy: 20,
  medium: 40,
  hard: 60,
}

const initialInstructions = [
  "Welcome to the AI mock interview.",
  "Please do not cheat or look up answers during the interview.",
  "Keep your camera centered and avoid moving around excessively.",
  "Speak clearly and try to answer concisely.",
]

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

const fillerWords = ["um", "uh", "like", "actually", "basically", "maybe", "i think", "sort of", "kind of"]

const countFillerWords = (text = "") =>
  fillerWords.reduce((count, filler) => {
    const matches = text.toLowerCase().match(new RegExp(`\\b${filler.replace(" ", "\\s+")}\\b`, "g"))
    return count + (matches?.length || 0)
  }, 0)

const scoreAnswerConfidence = (answer = "") => {
  const words = answer.split(/\s+/).filter(Boolean).length
  const fillerCount = countFillerWords(answer)
  return Math.max(0, Math.min(100, Math.round(45 + Math.min(35, words * 1.4) - Math.min(20, fillerCount * 4))))
}

const createEmptyVisualMetrics = () => ({
  faceDetected: false,
  eyeContact: false,
  attention: false,
  eyeContactScore: 0,
  attentionScore: 0,
  faceDetectedRatio: 0,
  lookingAwayCount: 0,
  totalSamples: 0,
  questionMetrics: [],
})

const calculateVisualSummary = (samples = []) => {
  if (!samples.length) return createEmptyVisualMetrics()

  const questionMap = new Map()
  let lookingAwayCount = 0
  let previousEyeContact = true

  samples.forEach((sample) => {
    if (!sample.eyeContact && previousEyeContact) lookingAwayCount += 1
    previousEyeContact = sample.eyeContact

    const key = typeof sample.questionIndex === "number" ? sample.questionIndex : -1
    const current = questionMap.get(key) || { questionIndex: key, samples: 0, faceDetected: 0, eyeContact: 0, attention: 0, lookingAwayCount: 0, previousEyeContact: true }
    current.samples += 1
    if (sample.faceDetected) current.faceDetected += 1
    if (sample.eyeContact) current.eyeContact += 1
    if (sample.attention) current.attention += 1
    if (!sample.eyeContact && current.previousEyeContact) current.lookingAwayCount += 1
    current.previousEyeContact = sample.eyeContact
    questionMap.set(key, current)
  })

  const faceDetectedCount = samples.filter((sample) => sample.faceDetected).length
  const eyeContactCount = samples.filter((sample) => sample.eyeContact).length
  const attentionCount = samples.filter((sample) => sample.attention).length

  return {
    faceDetected: samples.at(-1)?.faceDetected || false,
    eyeContact: samples.at(-1)?.eyeContact || false,
    attention: samples.at(-1)?.attention || false,
    eyeContactScore: Math.round((eyeContactCount / samples.length) * 100),
    attentionScore: Math.round((attentionCount / samples.length) * 100),
    faceDetectedRatio: Math.round((faceDetectedCount / samples.length) * 100),
    lookingAwayCount,
    totalSamples: samples.length,
    questionMetrics: Array.from(questionMap.values())
      .filter((item) => item.questionIndex >= 0)
      .map((item) => ({
        questionIndex: item.questionIndex,
        samples: item.samples,
        faceDetectedRatio: Math.round((item.faceDetected / item.samples) * 100),
        eyeContactRatio: Math.round((item.eyeContact / item.samples) * 100),
        attentionScore: Math.round((item.attention / item.samples) * 100),
        lookingAwayCount: item.lookingAwayCount,
      })),
  }
}

const estimateVisualAttention = (landmarks = []) => {
  if (!landmarks.length) return { faceDetected: false, eyeContact: false, attention: false }

  const nose = landmarks[1]
  const leftEyeOuter = landmarks[33]
  const leftEyeInner = landmarks[133]
  const rightEyeInner = landmarks[362]
  const rightEyeOuter = landmarks[263]
  const leftIris = landmarks[468]
  const rightIris = landmarks[473]

  const faceCentered = nose.x > 0.32 && nose.x < 0.68 && nose.y > 0.22 && nose.y < 0.78
  const leftGazeCentered = leftIris && leftEyeOuter && leftEyeInner
    ? (leftIris.x - leftEyeOuter.x) / Math.max(0.001, leftEyeInner.x - leftEyeOuter.x) > 0.25 && (leftIris.x - leftEyeOuter.x) / Math.max(0.001, leftEyeInner.x - leftEyeOuter.x) < 0.75
    : true
  const rightGazeCentered = rightIris && rightEyeInner && rightEyeOuter
    ? (rightIris.x - rightEyeInner.x) / Math.max(0.001, rightEyeOuter.x - rightEyeInner.x) > 0.25 && (rightIris.x - rightEyeInner.x) / Math.max(0.001, rightEyeOuter.x - rightEyeInner.x) < 0.75
    : true

  return {
    faceDetected: true,
    eyeContact: faceCentered && leftGazeCentered && rightGazeCentered,
    attention: faceCentered,
  }
}

const InterviewLive = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const interview = location.state?.interview
  const userVideoRef = useRef(null)
  const [localStream, setLocalStream] = useState(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [permissionError, setPermissionError] = useState("")
  const [timeLeft, setTimeLeft] = useState((modes[interview?.mode] || 40) * 60)
  const [questionItems, setQuestionItems] = useState(interview?.questions || [])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1)
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0)
  const questionTimerRef = useRef(null)
  const [initialSpoken, setInitialSpoken] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [isEnded, setIsEnded] = useState(false)
  const [isEndingFeedback, setIsEndingFeedback] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState({ confidence: 0, answered: 0, fillerWords: 0, avgWords: 0 })
  const [visualMetrics, setVisualMetrics] = useState(createEmptyVisualMetrics)
  const [visualStatus, setVisualStatus] = useState("loading")
  const recognitionRef = useRef(null)
  const localStreamRef = useRef(null)
  const activeInterviewRef = useRef(true)
  const faceLandmarkerRef = useRef(null)
  const visualAnimationRef = useRef(null)
  const lastVisualSampleAtRef = useRef(0)
  const visualSamplesRef = useRef([])
  const spokenQuestionRef = useRef("")
  const transcriptsRef = useRef([])
  const questionItemsRef = useRef(questionItems)
  const currentQuestionIndexRef = useRef(currentQuestionIndex)
  const restartRecognitionRef = useRef(false)
  const currentInterimIdRef = useRef(null)
  const [, setRecognizing] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const micOnRef = useRef(micOn)
  
  // Warning popup tracking
  const [warningCounts, setWarningCounts] = useState({ eyeContact: 0, attention: 0 })
  const [showWarning, setShowWarning] = useState(null) // null | "eyeContact" | "attention" | "confidence"
  const [isCheatDetected, setIsCheatDetected] = useState(false)
  const warningCountsRef = useRef({ eyeContact: 0, attention: 0 })
  const lastWarningTimeRef = useRef({ eyeContact: 0, attention: 0 })

  const speak = (text) => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(text)
      utter.onend = () => resolve(true)
      utter.onerror = () => resolve(false)
      synth.speak(utter)
    })
  }

  useEffect(() => {
    micOnRef.current = micOn
  }, [micOn])

  useEffect(() => {
    questionItemsRef.current = questionItems
  }, [questionItems])

  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    let cancelled = false

    const loadFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm")
        if (cancelled) return

        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          runningMode: "VIDEO",
          numFaces: 1,
        })
        if (!cancelled) setVisualStatus("ready")
      } catch (error) {
        console.error("Face detection setup failed", error)
        if (!cancelled) setVisualStatus("unavailable")
      }
    }

    loadFaceLandmarker()

    return () => {
      cancelled = true
      if (visualAnimationRef.current) window.cancelAnimationFrame(visualAnimationRef.current)
      try {
        faceLandmarkerRef.current?.close()
      } catch {
        /* ignored */
      }
    }
  }, [])

  useEffect(() => {
    if (!permissionGranted || !camOn || !faceLandmarkerRef.current || !userVideoRef.current) return undefined

    const detect = () => {
      const video = userVideoRef.current
      const detector = faceLandmarkerRef.current

      if (!activeInterviewRef.current || !video || !detector || video.readyState < 2) {
        visualAnimationRef.current = window.requestAnimationFrame(detect)
        return
      }

      const now = performance.now()
      if (now - lastVisualSampleAtRef.current >= 350) {
        lastVisualSampleAtRef.current = now
        try {
          const result = detector.detectForVideo(video, now)
          const landmarks = result.faceLandmarks?.[0] || []
          const estimate = estimateVisualAttention(landmarks)
          const sample = {
            ...estimate,
            questionIndex: currentQuestionIndexRef.current,
            timestamp: new Date().toISOString(),
          }
          visualSamplesRef.current = [...visualSamplesRef.current, sample].slice(-4000)
          setVisualMetrics(calculateVisualSummary(visualSamplesRef.current))
        } catch {
          // keep interview running even if a frame cannot be analyzed
        }
      }

      visualAnimationRef.current = window.requestAnimationFrame(detect)
    }

    visualAnimationRef.current = window.requestAnimationFrame(detect)

    return () => {
      if (visualAnimationRef.current) window.cancelAnimationFrame(visualAnimationRef.current)
    }
  }, [permissionGranted, camOn, visualStatus])

  const syncLocalStream = () => {
    const stream = localStreamRef.current
    if (!stream) {
      setLocalStream(null)
      return null
    }

    const activeTracks = stream.getTracks().filter((track) => track.readyState !== "ended")
    const nextStream = new MediaStream(activeTracks)
    localStreamRef.current = nextStream
    setLocalStream(nextStream)
    return nextStream
  }

  const stopRecognition = ({ commit = true } = {}) => {
    restartRecognitionRef.current = false
    if (commit) commitInterimTranscript()
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignored */ }
      recognitionRef.current = null
    }
    setRecognizing(false)
  }

  const stopTracks = (kind) => {
    const stream = localStreamRef.current
    if (!stream) return null

    stream.getTracks()
      .filter((track) => track.kind === kind)
      .forEach((track) => {
        track.stop()
        stream.removeTrack(track)
      })

    return syncLocalStream()
  }

  const requestTracks = async (constraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream.getTracks()
  }

  const addTracks = (tracks) => {
    const stream = localStreamRef.current || new MediaStream()
    tracks.forEach((track) => stream.addTrack(track))
    localStreamRef.current = stream
    return syncLocalStream()
  }

  useEffect(() => {
    transcriptsRef.current = transcripts
  }, [transcripts])

  useEffect(() => {
    const groupedAnswers = questionItemsRef.current
      .map((_, questionIndex) =>
        transcripts
          .filter((item) => item.speaker === "user" && item.questionIndex === questionIndex)
          .map((item) => item.text)
          .join(" ")
          .trim()
      )
      .filter(Boolean)

    const answered = groupedAnswers.filter((answer) => answer.split(/\s+/).filter(Boolean).length >= 4)
    const fillerCount = answered.reduce((sum, answer) => sum + countFillerWords(answer), 0)
    const avgWords = answered.length
      ? Math.round(answered.reduce((sum, answer) => sum + answer.split(/\s+/).filter(Boolean).length, 0) / answered.length)
      : 0
    const confidence = answered.length
      ? Math.round(answered.reduce((sum, answer) => sum + scoreAnswerConfidence(answer), 0) / answered.length)
      : 0

    setLiveMetrics({ confidence, answered: answered.length, fillerWords: fillerCount, avgWords })
  }, [transcripts])

  // Monitor metrics for warnings and cheat detection
  useEffect(() => {
    // Only start monitoring after interview has properly started
    if (isEnded || !activeInterviewRef.current || !permissionGranted || !initialSpoken) return
    // Don't monitor until camera analytics are ready
    if (visualStatus !== "ready") return

    const now = Date.now()
    const MINIMUM_WARNING_INTERVAL = 5000 // 5 seconds minimum between warnings for same metric
    const checkAndTriggerWarning = (metric, score, threshold = 60) => {
      if (score < threshold) {
        // Only show warning if enough time has passed since last warning for this metric
        if (now - lastWarningTimeRef.current[metric] > MINIMUM_WARNING_INTERVAL) {
          lastWarningTimeRef.current[metric] = now
          warningCountsRef.current[metric] += 1
          setWarningCounts({ ...warningCountsRef.current })
          
          // Show warning popup
          setShowWarning(metric)
          
          // Auto-dismiss after 4 seconds
          setTimeout(() => setShowWarning(null), 4000)
          
          // Check if both metrics have reached 3 violations each
          if (
            warningCountsRef.current.eyeContact >= 3 &&
            warningCountsRef.current.attention >= 3
          ) {
            setIsCheatDetected(true)
            // Auto-end interview after a short delay
            setTimeout(() => {
              performEndInterview(true)
            }, 2000)
          }
        }
      }
    }

    // Check eye contact (0-100 scale)
    const eyeContactScore = visualMetrics?.eyeContactScore
    if (typeof eyeContactScore === "number") {
      checkAndTriggerWarning("eyeContact", eyeContactScore)
    }

    // Check attention (0-100 scale)
    const attentionScore = visualMetrics?.attentionScore
    if (typeof attentionScore === "number") {
      checkAndTriggerWarning("attention", attentionScore)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualMetrics, isEnded, permissionGranted, initialSpoken, visualStatus])

  const getAnswerForQuestion = (questionIndex) =>
    transcriptsRef.current
      .filter((item) => item.speaker === "user" && item.questionIndex === questionIndex)
      .map((item) => item.text)
      .join(" ")
      .trim()

  const commitInterimTranscript = () => {
    const interimId = currentInterimIdRef.current
    if (!interimId) return

    setTranscripts((prev) =>
      prev.map((t) =>
        t.id === interimId && t.interim
          ? { ...t, interim: false, timestamp: new Date().toISOString() }
          : t
      )
    )
    currentInterimIdRef.current = null
  }

  // ensure the video element has the stream attached when stream or camOn changes
  useEffect(() => {
    try {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = camOn ? localStream : null
      }
    } catch {
      /* ignored */
    }
  }, [localStream, camOn])

  useEffect(() => {
    activeInterviewRef.current = true
    let cancelled = false

    if (!interview) {
      navigate("/dashboard")
      return
    }

    // request camera + mic
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled || !activeInterviewRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        setLocalStream(stream)
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream
        }
        setPermissionGranted(true)
        // notify backend
        try {
          await sendMediaPermission({ camera: true, microphone: true })
        } catch {
          // ignore backend errors for permissions
        }
        // speak instructions then ask intro
        try {
          for (const instr of initialInstructions) {
            if (cancelled || !activeInterviewRef.current) return
            // record AI instruction transcript
            setTranscripts((p) => [...p, { speaker: "ai", text: instr, timestamp: new Date().toISOString() }])
            const completed = await speak(instr)
            if (!completed || cancelled || !activeInterviewRef.current) return
          }
        } catch {
          // ignore speech errors
        }
        if (cancelled || !activeInterviewRef.current) return
        setInitialSpoken(true)
        setCurrentQuestionIndex(0)
      } catch {
        setPermissionError("Unable to access camera/microphone. Please allow permissions and refresh.")
      }
    }

    getMedia()

    return () => {
      cancelled = true
      activeInterviewRef.current = false
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* ignored */
      }
      stopRecognition()
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setLocalStream(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // start countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t)
          // interview finished
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [timeLeft])

  function startUserRecognition() {
    if (!activeInterviewRef.current || isEnded || !micOnRef.current) return
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    // avoid creating multiple recognizers
    try {
      stopRecognition()
      const rec = new SpeechRecognition()
      rec.lang = "en-US"
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      let finalTranscript = ""
      rec.onresult = (e) => {
        // ignore results if mic is turned off while recognition was running
        if (!micOnRef.current) return
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const res = e.results[i]
          if (res.isFinal) {
            finalTranscript += res[0].transcript
          } else {
            const interim = res[0].transcript
            if (interim.trim()) {
              setTranscripts((p) => {
                const interimId = currentInterimIdRef.current || `user-interim-${Date.now()}`
                currentInterimIdRef.current = interimId
                const existing = p.find((t) => t.id === interimId)
                const questionIndex = currentQuestionIndexRef.current
                const questionText = questionItemsRef.current[questionIndex]?.text

                if (existing) {
                  return p.map((t) =>
                    t.id === interimId
                      ? { ...t, text: interim.trim(), timestamp: new Date().toISOString(), interim: true, questionIndex, questionText }
                      : t
                  )
                }

                return [...p, { id: interimId, speaker: "user", text: interim.trim(), timestamp: new Date().toISOString(), interim: true, questionIndex, questionText }]
              })
            }
          }
        }
        if (finalTranscript) {
          setTranscripts((p) => {
            const finalText = finalTranscript.trim()
            if (!finalText) return p

            const interimId = currentInterimIdRef.current
            currentInterimIdRef.current = null
            const questionIndex = currentQuestionIndexRef.current
            const questionText = questionItemsRef.current[questionIndex]?.text

            if (interimId && p.some((t) => t.id === interimId)) {
              return p.map((t) =>
                t.id === interimId
                  ? { ...t, text: finalText, timestamp: new Date().toISOString(), interim: false, questionIndex, questionText }
                  : t
              )
            }

            return [...p, { id: `user-final-${Date.now()}`, speaker: "user", text: finalText, timestamp: new Date().toISOString(), questionIndex, questionText }]
          })
          finalTranscript = ""
        }
      }
      rec.onerror = () => {
        restartRecognitionRef.current = false
        try { rec.stop() } catch { /* ignored */ }
      }
      rec.onend = () => {
        commitInterimTranscript()
        setRecognizing(false)
        recognitionRef.current = null
        if (restartRecognitionRef.current && activeInterviewRef.current && !isEnded && micOnRef.current && !aiSpeaking) {
          window.setTimeout(() => {
            if (restartRecognitionRef.current && activeInterviewRef.current && !recognitionRef.current && micOnRef.current) {
              startUserRecognition()
            }
          }, 300)
        }
      }
      recognitionRef.current = rec
      restartRecognitionRef.current = true
      setRecognizing(true)
      rec.start()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // speak current question
    if (!activeInterviewRef.current || isEnded || currentQuestionIndex < 0) return
    const question = questionItems[currentQuestionIndex]
    if (!question?.text) return
    const spokenKey = `${currentQuestionIndex}:${question.text}`
    if (spokenQuestionRef.current === spokenKey) return
    spokenQuestionRef.current = spokenKey

    if (recognitionRef.current) {
      restartRecognitionRef.current = false
      commitInterimTranscript()
      try { recognitionRef.current.abort() } catch { /* ignored */ }
      recognitionRef.current = null
      setRecognizing(false)
    }

    const synth = window.speechSynthesis
    synth.cancel()
    // record AI question transcript
    setTranscripts((p) => [
      ...p,
      {
        speaker: "ai",
        text: question.text,
        timestamp: new Date().toISOString(),
        questionIndex: currentQuestionIndex,
        questionText: question.text,
      },
    ])
    const utter = new SpeechSynthesisUtterance(question.text)
    let recognitionFallbackId = null
    setAiSpeaking(true)
    utter.onend = () => {
      if (!activeInterviewRef.current || isEnded) return
      if (recognitionFallbackId) window.clearTimeout(recognitionFallbackId)
      setAiSpeaking(false)
      // start transcribing user's spoken answer if mic is enabled (use ref for latest value)
      if (micOnRef.current) startUserRecognition()

      // start per-question timer (seconds) based on mode; auto-advance when it reaches 0
      try {
        const seconds = (modes[interview?.mode] || 40)
        setQuestionTimeLeft(seconds)
        if (questionTimerRef.current) window.clearInterval(questionTimerRef.current)
        questionTimerRef.current = window.setInterval(() => {
          setQuestionTimeLeft((prev) => {
            if (prev <= 1) {
              if (questionTimerRef.current) window.clearInterval(questionTimerRef.current)
              // commit any interim text and advance
              try { stopRecognition({ commit: true }) } catch { /* ignored */ }
              // small timeout to allow UI updates
              window.setTimeout(() => {
                handleNextQuestion()
              }, 50)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } catch {
        /* ignore timer errors */
      }
    }
    utter.onerror = () => {
      if (!activeInterviewRef.current || isEnded) return
      if (recognitionFallbackId) window.clearTimeout(recognitionFallbackId)
      setAiSpeaking(false)
      if (micOnRef.current) startUserRecognition()
    }
    synth.speak(utter)
    recognitionFallbackId = window.setTimeout(() => {
      if (!activeInterviewRef.current || isEnded || !micOnRef.current || recognitionRef.current) return
      setAiSpeaking(false)
      startUserRecognition()
    }, Math.max(3000, question.text.length * 90))
    return () => {
      if (recognitionFallbackId) window.clearTimeout(recognitionFallbackId)
      try {
        synth.cancel()
      } catch {
        /* ignored */
      }
      if (questionTimerRef.current) {
        window.clearInterval(questionTimerRef.current)
        questionTimerRef.current = null
        setQuestionTimeLeft(0)
      }
    }
    // only depend on currentQuestionIndex to avoid duplicate triggers when questions array identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex])

  // clear question timer when question changes or interview ends
  useEffect(() => {
    if (!activeInterviewRef.current || isEnded) {
      if (questionTimerRef.current) {
        window.clearInterval(questionTimerRef.current)
        questionTimerRef.current = null
        setQuestionTimeLeft(0)
      }
      return undefined
    }
    return () => {
      if (questionTimerRef.current) {
        window.clearInterval(questionTimerRef.current)
        questionTimerRef.current = null
        setQuestionTimeLeft(0)
      }
    }
  }, [currentQuestionIndex, isEnded])

  // auto-advance when user provides a final answer for the current question
  useEffect(() => {
    if (!activeInterviewRef.current || isEnded || currentQuestionIndex < 0) return undefined

    const lastUserFinal = [...transcripts].reverse().find((t) => t.speaker === "user" && !t.interim && typeof t.questionIndex === "number")
    if (!lastUserFinal) return undefined

    // only advance if final answer corresponds to current question
    if (lastUserFinal.questionIndex === currentQuestionIndex) {
      // avoid double-advancing by clearing timer first
      if (questionTimerRef.current) {
        window.clearInterval(questionTimerRef.current)
        questionTimerRef.current = null
        setQuestionTimeLeft(0)
      }

      // small debounce to allow UI to commit transcripts
      const id = window.setTimeout(() => {
        try { stopRecognition({ commit: true }) } catch { /* ignored */ }
        handleNextQuestion()
      }, 350)

      return () => window.clearTimeout(id)
    }
    return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcripts, currentQuestionIndex, isEnded])

  const handleNextQuestion = async () => {
    stopRecognition()

    const activeIndex = currentQuestionIndexRef.current
    const activeQuestion = questionItemsRef.current[activeIndex]
    const answer = getAnswerForQuestion(activeIndex)

    if (interview?._id && activeQuestion && activeQuestion.category !== "intro" && activeQuestion.category !== "follow-up" && answer.length >= 40) {
      try {
        setFollowUpLoading(true)
        const res = await requestFollowUpQuestion({ interviewId: interview._id, questionIndex: activeIndex, answer })
        if (res?.followUp) {
          setQuestionItems((prev) => {
            const next = [...prev]
            next.splice(activeIndex + 1, 0, res.followUp)
            return next
          })
          setCurrentQuestionIndex(activeIndex + 1)
          return
        }
      } catch (error) {
        console.error("Failed to generate follow-up question", error)
      } finally {
        setFollowUpLoading(false)
      }
    }

    if (activeIndex >= questionItemsRef.current.length - 1) {
      performEndInterview()
      return
    }

    setCurrentQuestionIndex(activeIndex + 1)
  }
  
  const handleToggleMic = () => {
    setMicOn((prev) => {
      const next = !prev
      micOnRef.current = next

      if (!next) {
        stopRecognition()
        stopTracks("audio")
      } else {
        requestTracks({ audio: true })
          .then((tracks) => {
            if (!activeInterviewRef.current || !micOnRef.current) {
              tracks.forEach((track) => track.stop())
              return
            }

            stopTracks("audio")
            addTracks(tracks)
            if (!aiSpeaking && currentQuestionIndex >= 0) startUserRecognition()
          })
          .catch(() => {
            setPermissionError("Unable to access microphone. Please allow permissions and try again.")
            setMicOn(false)
            micOnRef.current = false
          })
      }
      try { sendMediaPermission({ camera: camOn, microphone: next }) } catch { /* ignored */ }
      return next
    })
  }

  const handleToggleCam = () => {
    setCamOn((prev) => {
      const next = !prev
      if (!next) {
        stopTracks("video")
      } else {
        requestTracks({ video: true })
          .then((tracks) => {
            if (!activeInterviewRef.current) {
              tracks.forEach((track) => track.stop())
              return
            }

            stopTracks("video")
            addTracks(tracks)
          })
          .catch(() => {
            setPermissionError("Unable to access camera. Please allow permissions and try again.")
            setCamOn(false)
          })
      }
      try { sendMediaPermission({ camera: next, microphone: micOn }) } catch { /* ignored */ }
      return next
    })
  }
  const handleEndInterview = () => {
    if (isEnded) return
    // show confirmation modal before ending
    setShowEndConfirm(true)
  }

  function performEndInterview(isCheat = false) {
    if (isEnded) return
    setIsEndingFeedback(true)
    activeInterviewRef.current = false
    restartRecognitionRef.current = false
    setIsEnded(true)
    setAiSpeaking(false)
    // stop any active recognition
    if (recognitionRef.current) {
      restartRecognitionRef.current = false
      commitInterimTranscript()
      try { recognitionRef.current.abort() } catch { /* ignored */ }
      recognitionRef.current = null
      setRecognizing(false)
    }
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignored */
    }
    // stop media
    const stream = localStreamRef.current || localStream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    // prepare payload to save results
    const initialMinutes = modes[interview?.mode] || 40
    const totalSeconds = initialMinutes * 60
    const durationSeconds = totalSeconds - (typeof timeLeft === "number" ? timeLeft : 0)

    ;(async () => {
      let completedInterview = {
        ...interview,
        answeredCount: Math.max(0, currentQuestionIndex + 1),
        durationSeconds,
        questions: questionItemsRef.current,
        transcripts: transcriptsRef.current,
        visualMetrics,
        isCheat,
      }

      try {
        if (interview && interview._id) {
          const res = await endInterviewWithTranscripts({
            interviewId: interview._id,
            answeredCount: Math.max(0, currentQuestionIndex + 1),
            durationSeconds,
            transcripts: transcriptsRef.current,
            visualMetrics,
            isCheat,
          })
          completedInterview = res?.interview || completedInterview
        }
      } catch (e) {
        // ignore errors but still show local feedback report
        console.error("Failed to save interview result", e)
      } finally {
        cacheCompletedInterview(completedInterview, user)
        const targetUrl = interview && interview._id ? `/interview/feedback?id=${interview._id}` : "/interview/feedback"
        navigate(targetUrl, { replace: true, state: { interview: completedInterview } })
      }
    })()
  }

  // auto-end when timer reaches 0
  useEffect(() => {
    if (timeLeft !== 0 || isEnded || !initialSpoken) return undefined

    const timeoutId = window.setTimeout(() => {
      performEndInterview()
    }, 500)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isEnded, initialSpoken])

  const handleConfirmYes = () => {
    setShowEndConfirm(false)
    performEndInterview()
  }

  const handleConfirmNo = () => {
    setShowEndConfirm(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-400">Live Interview</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{interview?.trackTitle}</h1>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Mode: {interview?.mode}</div>
            <div className="mt-2 text-2xl font-mono text-white">{formatTime(timeLeft)}</div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-800 p-2">
                    <i className="fa-solid fa-robot text-lg text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">AI Interviewer</div>
                    <div className="text-white">Voice & Text only</div>
                  </div>
                </div>
                <div className="text-sm text-slate-400">{aiSpeaking ? "AI is speaking..." : "Listening"}</div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-center">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>AI question (text)</span>
                    {questionTimeLeft > 0 && <span className="font-mono text-white">{formatTime(questionTimeLeft)}</span>}
                  </div>
                  <div className="min-h-[80px] rounded-lg bg-slate-900/60 p-4 text-left text-white">{questionItems[currentQuestionIndex]?.text || "Preparing your first question..."}</div>
                  {questionItems[currentQuestionIndex]?.category && (
                    <div className="mt-3 text-left">
                      <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
                        {questionItems[currentQuestionIndex].category}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-center">
                  <div className="mb-3 text-sm text-slate-400">Your camera</div>
                  {camOn ? (
                    <video ref={userVideoRef} autoPlay muted playsInline className="mx-auto h-48 w-full rounded-lg bg-black object-cover" />
                  ) : (
                    <div className="mx-auto flex h-48 w-full items-center justify-center rounded-lg bg-black/60 text-sm text-slate-400">Camera turned off</div>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button onClick={handleToggleCam} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{camOn ? 'Camera Off' : 'Camera On'}</button>
                    <button onClick={handleToggleMic} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">{micOn ? 'Mic Off' : 'Mic On'}</button>
                  </div>
                  {!permissionGranted && <p className="mt-2 text-sm text-rose-400">{permissionError || "Requesting camera and microphone permissions..."}</p>}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleNextQuestion}
                      disabled={followUpLoading || isEnded}
                      className="rounded-2xl border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {followUpLoading ? "Preparing follow-up..." : "Next Question"}
                    </button>
                    <button
                      onClick={handleEndInterview}
                      disabled={isEnded}
                      className="rounded-2xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      End Interview
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-400">Answered: {Math.max(0, currentQuestionIndex + 1)} / {questionItems.length || 0}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-sm text-slate-400">Notes</div>
              <div className="mt-2 text-sm text-slate-400">You can only speak during the interview. The AI will read questions aloud and display them as text.</div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-sm text-slate-400">Live Analysis</div>
              <div className="mt-3 grid gap-2">
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Confidence</span><span className="text-white">{liveMetrics.confidence ? `${liveMetrics.confidence}%` : "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Eye contact</span><span className="text-white">{typeof visualMetrics.eyeContactScore === "number" ? `${visualMetrics.eyeContactScore}%` : "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Attention</span><span className="text-white">{typeof visualMetrics.attentionScore === "number" ? `${visualMetrics.attentionScore}%` : "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Face detected</span><span className="text-white">{typeof visualMetrics.faceDetectedRatio === "number" ? `${visualMetrics.faceDetectedRatio}%` : "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Looking away</span><span className="text-white">{typeof visualMetrics.lookingAwayCount === "number" ? visualMetrics.lookingAwayCount : "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Camera analytics</span><span className="text-white">{visualStatus === "loading" ? "Loading..." : visualStatus === "ready" ? "Ready" : "Unavailable"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Avg words/Q</span><span className="text-white">{liveMetrics.avgWords || "-"}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Filler words</span><span className="text-white">{liveMetrics.fillerWords}</span></div>
                <div className="flex items-center justify-between text-sm text-slate-400"><span>Answered</span><span className="text-white">{liveMetrics.answered}</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-sm text-slate-400">Transcript</div>
              <div className="mt-3 max-h-48 overflow-y-auto">
                {transcripts.length === 0 ? (
                  <p className="text-sm text-slate-500">No transcript yet</p>
                ) : (
                  transcripts.slice().reverse().slice(0, 10).map((t, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="text-xs text-slate-400">{t.speaker === 'ai' ? 'AI' : 'You'} • {new Date(t.timestamp).toLocaleTimeString()}</div>
                      <div className="text-sm text-white">{t.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <p className="text-sm font-semibold text-white">Cheat warning</p>
              <p className="mt-2 text-sm text-slate-400">If the system detects repeated low attention and eye contact, your session will end and feedback will reflect that.</p>
            </div>
          </aside>
        </div>
        {showEndConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white">End interview</h3>
              <p className="mt-2 text-sm text-slate-400">Are you sure you want to end the interview? Your feedback report will be generated now.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={handleConfirmNo} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white">No</button>
                <button onClick={handleConfirmYes} className="rounded-2xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Yes, end</button>
              </div>
            </div>
          </div>
        )}

        {isEndingFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-indigo-500/15 text-indigo-300">
                <i className="fa-solid fa-spinner animate-spin" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Generating feedback</h3>
              <p className="mt-2 text-sm text-slate-400">Please wait while your interview is saved and evaluated.</p>
            </div>
          </div>
        )}

        {/* Warning Popups */}
        {showWarning === "eyeContact" && (
          <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-yellow-500 bg-yellow-900/80 p-4 shadow-xl animate-pulse">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-yellow-500/20 p-2">
                <i className="fa-solid fa-eye text-lg text-yellow-300" />
              </div>
              <div>
                <h4 className="font-semibold text-yellow-200">Low Eye Contact</h4>
                <p className="mt-1 text-sm text-yellow-100">Your eye contact score is below 60%. Please look more towards the camera.</p>
                <p className="mt-2 text-xs text-yellow-200">Warnings: {warningCounts.eyeContact}/3</p>
              </div>
            </div>
          </div>
        )}

        {showWarning === "attention" && (
          <div className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border border-amber-500 bg-amber-900/80 p-4 shadow-xl animate-pulse">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/20 p-2">
                <i className="fa-solid fa-head-side-virus text-lg text-amber-300" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-200">Low Attention Score</h4>
                <p className="mt-1 text-sm text-amber-100">Your attention score is below 60%. Please stay focused and avoid distractions.</p>
                <p className="mt-2 text-xs text-amber-200">Warnings: {warningCounts.attention}/3</p>
              </div>
            </div>
          </div>
        )}

        {isCheatDetected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl border border-red-500 bg-red-900/90 p-6 shadow-2xl text-center">
              <div className="mb-4 text-5xl">
                <i className="fa-solid fa-triangle-exclamation text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-red-100">Interview Ended</h3>
              <p className="mt-3 text-sm text-red-200">
                Multiple warnings were detected for low Eye Contact, Attention, and Confidence scores. The interview has been automatically ended.
              </p>
              <p className="mt-2 text-xs text-red-300">Your feedback will reflect this incident.</p>
              <button
                onClick={handleConfirmYes}
                className="mt-6 w-full rounded-2xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              >
                View feedback
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default InterviewLive
