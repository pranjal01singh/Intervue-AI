import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/useAuth"
import { getInterviewDetails } from "../services/interviewService"

const colorClasses = {
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500",
    soft: "bg-emerald-500/12",
    bar: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500",
    soft: "bg-amber-500/12",
    bar: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-300",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-500",
    soft: "bg-violet-500/12",
    bar: "bg-violet-500",
    pill: "bg-violet-500/15 text-violet-300",
  },
  rose: {
    pill: "bg-rose-500/15 text-rose-300",
  },
}

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins} min ${secs} sec`
}

const InterviewFeedback = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [interviewState, setInterviewState] = useState(location.state?.interview)
  const [loading, setLoading] = useState(() => {
    const params = new URLSearchParams(location.search)
    const interviewId = params.get("id")
    const feedback = location.state?.interview?.feedback
    return Boolean(interviewId && (!feedback || Object.keys(feedback).length === 0))
  })
  const params = new URLSearchParams(location.search)
  const interviewId = params.get("id")
  const interview = interviewState
  const feedback = interview?.feedback || {}
  const feedbackScores = feedback.scores || {}
  const overallScore = feedback.overallScore ?? 0
  const answeredCount = interview?.answeredCount ?? 0
  const totalQuestions = interview?.questions?.length ?? 0
  const scoreCards = [
    { label: "Communication", score: feedbackScores.communication || 0, icon: "fa-solid fa-comments", color: "emerald" },
    { label: "Confidence", score: feedbackScores.confidence || 0, icon: "fa-solid fa-user-check", color: "amber" },
    { label: "Tech skills", score: feedbackScores.technicalSkills || 0, icon: "fa-solid fa-code", color: "violet" },
    { label: "Answer depth", score: feedbackScores.answerDepth || 0, icon: "fa-solid fa-layer-group", color: "amber" },
    { label: "Eye contact", score: feedbackScores.eyeContact || 0, icon: "fa-solid fa-eye", color: "emerald" },
    { label: "Attention", score: feedbackScores.attention || 0, icon: "fa-solid fa-bolt", color: "violet" },
  ]
  const strengths = feedback.strengths?.length
    ? feedback.strengths
    : [{ title: "Interview completed", text: "Feedback will appear here after AI evaluation is saved." }]
  const improvements = feedback.improvementAreas?.length
    ? feedback.improvementAreas
    : [{ title: "Practice next round", text: "Try again with clearer examples and more detailed technical reasoning." }]
  const breakdown = feedback.questionBreakdown?.length ? feedback.questionBreakdown : []
  const visualMetrics = interview?.visualMetrics || {}
  const isCheat = feedback.isCheat ?? false

  // Generate performance message based on score
  const getPerformanceMessage = () => {
    if (isCheat) return "Interview ended due to suspicious activity"
    if (overallScore === 0) return "No answers recorded"
    if (overallScore >= 80) return "Excellent performance"
    if (overallScore >= 60) return "Good performance"
    if (overallScore >= 40) return "Average performance"
    if (overallScore >= 20) return "Below expectations"
    return "Room for improvement"
  }

  const retryInterview = () => {
    navigate("/interview-setup")
  }

  useEffect(() => {
    if (!interviewId) return
    if (interviewState && interviewState.feedback && Object.keys(interviewState.feedback).length > 0) return

    getInterviewDetails(interviewId)
      .then((data) => {
        if (data?.success && data?.interview) {
          setInterviewState(data.interview)
        }
      })
      .catch((error) => {
        console.error("Failed to load interview feedback:", error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [interviewId, interviewState])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-slate-300">Loading interview feedback...</div>
      </main>
    )
  }

  if (!interview) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center text-slate-300">
          Interview feedback could not be loaded. Please return to the dashboard and try again.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-400">Interview complete</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Your feedback report</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate("/dashboard")} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-violet-400 hover:text-violet-200">
              <i className="fa-solid fa-table-columns mr-2" />
              Dashboard
            </button>
            <button onClick={() => window.print()} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-violet-400 hover:text-violet-200">
              <i className="fa-solid fa-download mr-2" />
              Download PDF
            </button>
            <button onClick={retryInterview} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-violet-400 hover:text-violet-200">
              <i className="fa-solid fa-rotate-right mr-2" />
              Retry interview
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-400">
                {interview?.detectedDomain || interview?.trackTitle || "Full Stack Developer"} - {interview?.mode || "medium"} - {formatDuration(interview?.durationSeconds || 2412)}
              </p>
              <h2 className={`mt-3 text-3xl font-bold ${isCheat ? "text-red-400" : overallScore >= 80 ? "text-emerald-400" : overallScore >= 60 ? "text-blue-400" : overallScore >= 40 ? "text-yellow-400" : "text-orange-400"}`}>
                {getPerformanceMessage()}, {user?.name || "Candidate"}!
              </h2>
              <div className="mt-4 flex flex-wrap gap-5 text-sm font-medium text-slate-400">
                <span><i className="fa-regular fa-calendar mr-2" />{interview?.completedAt ? new Date(interview.completedAt).toLocaleDateString() : "Today"}</span>
                <span><i className="fa-regular fa-clock mr-2" />{formatDuration(interview?.durationSeconds || 2412)}</span>
                <span><i className="fa-solid fa-list-check mr-2" />{answeredCount} of {totalQuestions} answered</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="grid h-32 w-32 place-items-center rounded-full"
                style={{ background: `conic-gradient(#6d5dfc ${overallScore * 3.6}deg, #1f2937 0deg)` }}
              >
                <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-950 text-center">
                  <div>
                    <div className="text-4xl font-bold text-white">{overallScore}</div>
                    <div className="text-sm text-slate-500">/ 100</div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-400">Overall score</p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {scoreCards.map((card) => {
            const colors = colorClasses[card.color]
            return (
              <div key={card.label} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 text-center">
                <div className={`mx-auto grid h-10 w-10 place-items-center rounded-2xl ${colors.soft} ${colors.text}`}>
                  <i className={card.icon} />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-400">{card.label}</p>
                <div className="mt-3">
                  <span className={`text-3xl font-bold ${colors.text}`}>{card.score}</span>
                  <span className="text-sm font-semibold text-slate-500">/100</span>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${card.score}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold uppercase tracking-[0.14em] text-slate-400">Video presence</h3>
            <span className="text-sm text-slate-500">{visualMetrics.totalSamples ? `${visualMetrics.totalSamples} samples` : "Camera analytics unavailable"}</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Eye contact score</p>
              <p className="mt-3 text-3xl font-bold text-white">{visualMetrics.eyeContactScore ?? "-"}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Attention score</p>
              <p className="mt-3 text-3xl font-bold text-white">{visualMetrics.attentionScore ?? "-"}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Face detection ratio</p>
              <p className="mt-3 text-3xl font-bold text-white">{visualMetrics.faceDetectedRatio ?? "-"}%</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-sm text-slate-400">Looking away events</p>
              <p className="mt-3 text-3xl font-bold text-white">{visualMetrics.lookingAwayCount ?? "-"}</p>
            </div>
          </div>
        </section>

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
            <h3 className="text-lg font-bold uppercase tracking-[0.14em] text-slate-400">
              <i className="fa-solid fa-shield-halved mr-3 text-emerald-400" />
              Strengths
            </h3>
            <div className="mt-6 space-y-5">
              {strengths.map((item) => (
                <div key={item.title} className="flex gap-4 border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                    <i className={item.icon || "fa-solid fa-shield-halved"} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
            <h3 className="text-lg font-bold uppercase tracking-[0.14em] text-slate-400">
              <i className="fa-solid fa-triangle-exclamation mr-3 text-amber-400" />
              Improvements
            </h3>
            <div className="mt-6 space-y-5">
              {improvements.map((item, index) => (
                <div key={item.title} className="flex gap-4 border-b border-slate-800 pb-5 last:border-b-0 last:pb-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-300">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
          <h3 className="text-lg font-bold uppercase tracking-[0.14em] text-slate-400">
            <i className="fa-solid fa-clipboard-list mr-3 text-violet-400" />
            Question-by-question breakdown
          </h3>
          <div className="mt-7 space-y-6">
            {breakdown.length === 0 ? (
              <p className="text-sm text-slate-400">No question breakdown available yet.</p>
            ) : breakdown.map((item) => (
              <div key={item.question} className="flex flex-col gap-4 border-b border-slate-800 pb-6 last:border-b-0 last:pb-0 md:flex-row md:items-start md:justify-between">
                <div>
                  <h4 className="font-semibold text-white">{item.question}</h4>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item.feedback}</p>
                </div>
                <div className={`shrink-0 rounded-full px-4 py-1 text-center text-sm font-bold ${item.skipped ? colorClasses.rose.pill : item.score >= 80 ? colorClasses.emerald.pill : item.score >= 70 ? colorClasses.violet.pill : colorClasses.amber.pill}`}>
                  {item.skipped ? "Skipped" : `${item.score} / 100`}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-7 md:flex-row md:items-center md:justify-between">
          <p className="text-xl font-semibold text-slate-300">
            Ready to improve? <span className="text-white">Practice the weak areas and retry.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.print()} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-emerald-400 hover:text-emerald-200">
              <i className="fa-solid fa-floppy-disk mr-2" />
              Save report
            </button>
            <button onClick={retryInterview} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-violet-400 hover:text-violet-200">
              <i className="fa-solid fa-arrow-trend-up mr-2" />
              Practice weak areas
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}

export default InterviewFeedback
