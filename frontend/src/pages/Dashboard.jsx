import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import Button from "../components/Button"
import { useAuth } from "../context/useAuth"
import { getCachedCompletedInterviews, getInterviewHistory } from "../services/interviewService"

const trackCards = [
  {
    iconClass: "fa-solid fa-code",
    title: "Full Stack Developer",
    description: "React, Node.js, APIs, databases, system design",
    difficulty: "Medium",
    questionRange: "15-20 questions",
    color: "border-indigo-500 bg-slate-900 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
  {
    iconClass: "fa-solid fa-brain",
    title: "AI / ML Engineer",
    description: "LLMs, RAG, embeddings, model fine-tuning, MLOps",
    difficulty: "Hard",
    questionRange: "12-18 questions",
    color: "bg-slate-800 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
  {
    iconClass: "fa-solid fa-chart-line",
    title: "Data Analyst",
    description: "SQL, Python, visualization, statistics, dashboards",
    difficulty: "Easy",
    questionRange: "15-20 questions",
    color: "bg-slate-800 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
  {
    iconClass: "fa-solid fa-paint-brush",
    title: "Frontend Developer",
    description: "React, CSS, performance, accessibility, TypeScript",
    difficulty: "Medium",
    questionRange: "15-18 questions",
    color: "bg-slate-800 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
  {
    iconClass: "fa-solid fa-server",
    title: "Backend Developer",
    description: "Node.js, APIs, databases, caching, microservices",
    difficulty: "Medium",
    questionRange: "15-20 questions",
    color: "bg-slate-800 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
  {
    iconClass: "fa-solid fa-cogs",
    title: "DevOps Engineer",
    description: "Docker, Kubernetes, CI/CD, cloud infra, monitoring",
    difficulty: "Hard",
    questionRange: "12-16 questions",
    color: "bg-slate-800 text-slate-100",
    buttonClass: "bg-indigo-600 text-white hover:bg-indigo-500",
  },
]

const getDurationSeconds = (interview) => {
  if (typeof interview.durationSeconds === "number" && interview.durationSeconds > 0) return interview.durationSeconds

  const startedAt = interview.startedAt ? new Date(interview.startedAt).getTime() : null
  const endedAt = interview.completedAt || interview.updatedAt ? new Date(interview.completedAt || interview.updatedAt).getTime() : null
  if (!startedAt || !endedAt || Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt <= startedAt) return 0

  return Math.round((endedAt - startedAt) / 1000)
}

const getAnsweredCount = (interview) => {
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
      const wordCount = typeof item.text === "string" ? item.text.trim().split(/\s+/).filter(Boolean).length : 0
      if (item.speaker === "user" && !item.interim && typeof item.questionIndex === "number" && wordCount >= 4) {
        answeredQuestions.add(item.questionIndex)
      }
    })
    return answeredQuestions.size
  }

  return 0
}

const getBestScore = (interviews) => {
  const scores = interviews
    .map((interview) => interview.feedback?.overallScore)
    .filter((score) => typeof score === "number")

  return scores.length ? Math.max(...scores) : null
}

const getDashboardStats = (interviews, apiStats) => {
  const completedInterviews = interviews.filter((interview) => interview.status === "completed" || interview.completedAt || interview.feedback?.generatedAt)
  const totalInterviews = apiStats?.totalInterviews || completedInterviews.length
  const totalTimeSeconds = apiStats?.totalTimeSeconds || completedInterviews.reduce((sum, interview) => sum + getDurationSeconds(interview), 0)
  const avgAnswered = apiStats?.avgAnswered || (completedInterviews.length
    ? Math.round(completedInterviews.reduce((sum, interview) => sum + getAnsweredCount(interview), 0) / completedInterviews.length)
    : 0)
  const cachedBestScore = getBestScore(completedInterviews)
  const bestScore = typeof apiStats?.bestScore === "number" && apiStats.bestScore > 0 ? apiStats.bestScore : cachedBestScore

  return { totalInterviews, totalTimeSeconds, avgAnswered, bestScore }
}

const mergeInterviewHistory = (apiInterviews, cachedInterviews) => {
  const byId = new Map()

  ;[...cachedInterviews, ...apiInterviews].forEach((interview) => {
    if (!interview?._id) return
    byId.set(interview._id, {
      ...byId.get(interview._id),
      ...interview,
      status: interview.status || byId.get(interview._id)?.status || "completed",
    })
  })

  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.completedAt || a.updatedAt || a.startedAt || 0).getTime()
    const bTime = new Date(b.completedAt || b.updatedAt || b.startedAt || 0).getTime()
    return bTime - aTime
  })
}

const Dashboard = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState([])
  const [stats, setStats] = useState({ totalInterviews: 0, totalTimeSeconds: 0, avgAnswered: 0, bestScore: null })
  const [loading, setLoading] = useState(false)

  const loadInterviewHistory = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    try {
      const res = await getInterviewHistory()
      if (res?.success) {
        const history = mergeInterviewHistory(res.interviews || [], getCachedCompletedInterviews(user))
        setInterviews(history)
        setStats(getDashboardStats(history, res.stats))
      }
    } catch {
      // ignore
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadInterviewHistory()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadInterviewHistory, location.key])

  useEffect(() => {
    const refreshHistory = () => {
      loadInterviewHistory({ showLoading: false })
    }

    window.addEventListener("focus", refreshHistory)
    window.addEventListener("pageshow", refreshHistory)

    return () => {
      window.removeEventListener("focus", refreshHistory)
      window.removeEventListener("pageshow", refreshHistory)
    }
  }, [loadInterviewHistory])

  const timeHours = (secs) => {
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  }

  const handleLogout = () => {
    logout()
    navigate("/", { replace: true })
  }

  const completedInterviews = interviews.filter((interview) => interview.status === "completed" || interview.completedAt || interview.feedback?.generatedAt)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              AI Mock Interview Platform
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">Welcome, {user?.name}</h1>
          </div>
          <Button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:ring-rose-500" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Candidate dashboard
                </p>
                <h2 className="mt-3 text-4xl font-bold text-white">
                  Start your next AI mock interview
                </h2>
                <p className="mt-4 max-w-2xl text-slate-400">
                  Select a role, practice with AI-powered questions, and track your progress across
                  scorecards, time practiced, and past interviews.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-3xl bg-slate-800/80 p-5 text-center shadow-inner shadow-slate-950/10">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Interviews</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{stats.totalInterviews}</p>
                  <p className="mt-1 text-xs text-slate-500">Recent interviews</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Avg answered</p>
              <p className="mt-4 text-3xl font-semibold text-white">{stats.avgAnswered || "-"}</p>
              <p className="mt-2 text-sm text-slate-500">Avg questions answered</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Time practiced</p>
              <p className="mt-4 text-3xl font-semibold text-white">{timeHours(stats.totalTimeSeconds)}</p>
              <p className="mt-2 text-sm text-slate-500">Total time across interviews</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Best score</p>
              <p className="mt-4 text-3xl font-semibold text-white">{typeof stats.bestScore === "number" ? `${stats.bestScore}/100` : "-"}</p>
              <p className="mt-2 text-sm text-slate-500">Highest feedback score</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/10">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Recent activity</p>
              <p className="mt-4 text-3xl font-semibold text-white">{completedInterviews.length}</p>
              <p className="mt-2 text-sm text-slate-500">Completed interviews</p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                Choose your interview track
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                Select a role and start your AI-powered mock interview.
              </p>
            </div>
            <p className="text-sm text-slate-400">Pick one of the six role tracks below.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {trackCards.map((card, index) => (
              <div key={index} className={`rounded-3xl border border-slate-800 p-6 shadow-lg shadow-slate-950/10 ${card.color}`}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBgClass} text-lg text-white`}>
                    <i className={card.iconClass} />
                  </div>
                  <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {card.difficulty}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{card.description}</p>
                <div className="mt-6 flex items-center justify-between gap-4 text-sm text-slate-400">
                  <span>{card.questionRange}</span>
                </div>
                <div className="mt-6">
                  <Button
                    className={`${card.buttonClass} w-full rounded-2xl py-3 text-sm font-semibold`}
                    onClick={() => navigate("/interview-setup", { state: { selectedTrackId: card.id } })}
                  >
                    Start interview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Recent interviews</h3>
                <p className="mt-1 text-sm text-slate-500">Review the last sessions you completed.</p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 text-slate-400">
              {loading ? (
                <p className="text-sm">Loading...</p>
              ) : completedInterviews.length === 0 ? (
                <>
                  <p className="text-sm">No interviews yet</p>
                  <p className="mt-2 text-sm text-slate-500">Complete your first interview to see history.</p>
                </>
              ) : (
                <div className="space-y-4">
                  {completedInterviews.slice(0, 6).map((it) => (
                    <div key={it._id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{it.trackTitle}</div>
                        <div className="text-xs text-slate-400">{new Date(it.startedAt).toLocaleString()} • {it.mode}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 md:justify-end">
                        <div className="md:text-right">
                        <div>{timeHours(getDurationSeconds(it))}</div>
                        <div className="mt-1 text-white">{getAnsweredCount(it)} Q</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/interview/feedback?id=${it._id}`, { state: { interview: it } })}
                          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-white hover:border-violet-400 hover:text-violet-200"
                        >
                          View feedback
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Tips before you start</h3>
                <p className="mt-1 text-sm text-slate-500">Prepare to get the most from your mock interview.</p>
              </div>
            </div>
            <div className="space-y-4 text-slate-300">
              <div className="flex items-start gap-3 rounded-3xl bg-slate-950/70 p-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/80 text-white">
                  <i className="fa-solid fa-microphone" />
                </div>
                <div>
                  <p className="font-semibold text-white">Allow mic and camera access</p>
                  <p className="mt-1 text-sm text-slate-400">Grant permissions when prompted — required for interview feedback.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-3xl bg-slate-950/70 p-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/80 text-white">
                  <i className="fa-solid fa-file-lines" />
                </div>
                <div>
                  <p className="font-semibold text-white">Keep your resume ready</p>
                  <p className="mt-1 text-sm text-slate-400">AI will generate questions from your projects and experience.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-3xl bg-slate-950/70 p-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800/80 text-white">
                  <i className="fa-solid fa-eye" />
                </div>
                <div>
                  <p className="font-semibold text-white">Maintain eye contact</p>
                  <p className="mt-1 text-sm text-slate-400">Look at the camera for a better confidence score.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Dashboard
