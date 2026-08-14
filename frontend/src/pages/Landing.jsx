import { Link, Navigate } from "react-router-dom"
import { interviewTracks } from "../data/interviewTracks"
import { useAuth } from "../context/useAuth"

const features = [
  {
    iconClass: "fa-solid fa-file-lines",
    title: "Resume-based questions",
    description: "AI reads your resume and generates personalized questions from your projects, skills, and experience.",
    tone: "bg-violet-500/10 text-violet-300",
  },
  {
    iconClass: "fa-solid fa-eye",
    title: "Face and eye contact analysis",
    description: "Real-time camera analysis tracks your eye contact, expressions, and confidence level throughout the session.",
    tone: "bg-emerald-500/10 text-emerald-300",
  },
  {
    iconClass: "fa-solid fa-microphone-lines",
    title: "Voice-based answers",
    description: "Speak your answers naturally. Speech-to-text captures everything and AI evaluates communication quality.",
    tone: "bg-amber-500/10 text-amber-300",
  },
  {
    iconClass: "fa-solid fa-robot",
    title: "AI avatar interviewer",
    description: "A conversational interviewer asks follow-ups, listens, and responds like a real interview would.",
    tone: "bg-rose-500/10 text-rose-300",
  },
  {
    iconClass: "fa-solid fa-clock",
    title: "Timed interview modes",
    description: "Choose easy, medium, or hard sessions with realistic time limits and pacing.",
    tone: "bg-teal-500/10 text-teal-300",
  },
  {
    iconClass: "fa-solid fa-chart-simple",
    title: "Detailed scorecard",
    description: "Get scores for communication, tech depth, confidence, eye contact, and per-question feedback.",
    tone: "bg-indigo-500/10 text-indigo-300",
  },
]

const steps = [
  { iconClass: "fa-solid fa-user-plus", title: "Create account", text: "Sign up free. No card needed." },
  { iconClass: "fa-solid fa-layer-group", title: "Pick your track", text: "Choose your role and difficulty." },
  { iconClass: "fa-solid fa-file-arrow-up", title: "Upload resume", text: "AI creates personal questions." },
  { iconClass: "fa-solid fa-video", title: "Give interview", text: "Speak your answers and beat the timer." },
  { iconClass: "fa-solid fa-chart-line", title: "Get feedback", text: "Review strengths and improvements." },
]

const stats = [
  { value: "6+", label: "Role tracks" },
  { value: "AI", label: "Resume-based Qs" },
  { value: "3", label: "Difficulty modes" },
  { value: "100%", label: "Private and secure" },
]

const difficultyStyles = {
  Easy: "bg-emerald-500/10 text-emerald-300",
  Medium: "bg-violet-500/10 text-violet-300",
  Hard: "bg-rose-500/10 text-rose-300",
}

const trackIconStyles = {
  "full-stack": "bg-violet-500/10 text-violet-300",
  "ai-ml": "bg-emerald-500/10 text-emerald-300",
  "data-analyst": "bg-amber-500/10 text-amber-300",
  frontend: "bg-fuchsia-500/10 text-fuchsia-300",
  backend: "bg-sky-500/10 text-sky-300",
  devops: "bg-rose-500/10 text-rose-300",
}

const Landing = () => {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="min-h-screen bg-[#070a0f] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a0f]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-xs">
              <i className="fa-solid fa-message" aria-hidden="true" />
            </span>
            IntervueAI
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <a href="#features" className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-slate-300 hover:border-violet-400/50 hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-slate-300 hover:border-violet-400/50 hover:text-white">
              How it works
            </a>
            <a href="#tracks" className="rounded-lg border border-white/10 px-5 py-2 text-sm font-semibold text-slate-300 hover:border-violet-400/50 hover:text-white">
              Tracks
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-violet-400/50">
              Log in
            </Link>
            <Link to="/register" className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:border-violet-400/50 sm:inline-flex">
              Sign up free
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-16 text-center sm:px-6 lg:pt-24">
        <Link to="/login" className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200 hover:border-violet-300/60">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
          AI-powered mock interviews - free to start
        </Link>

        <h1 className="mx-auto mt-8 max-w-5xl text-4xl font-black leading-tight tracking-normal text-white sm:text-6xl lg:text-7xl">
          Crack your next interview with{" "}
          <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-300 bg-clip-text text-transparent">
            AI as your coach
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-7 text-slate-400 sm:text-lg">
          Real-time AI interviewer, resume-based questions, face and voice analysis, and practice like it is the real thing.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-6 text-sm font-bold text-white hover:border-violet-400/60 sm:w-auto">
            <i className="fa-solid fa-play" aria-hidden="true" />
            Start free interview
          </Link>
          <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-bold text-white hover:border-emerald-400/60 sm:w-auto">
            See how it works
          </Link>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((item, index) => (
            <div key={item.label} className={index > 0 ? "border-l border-white/10" : ""}>
              <div className="text-3xl font-black text-white">{item.value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-6xl rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 border-b border-white/5 px-2 pb-3">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-4 text-xs font-semibold text-slate-600">intervueai.app / interview / room</span>
          </div>
          <div className="grid gap-4 pt-4 lg:grid-cols-2">
            <div className="min-h-60 rounded-lg border border-violet-500/10 bg-[#0d1020] p-4">
              <div className="inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300">36:55</div>
              <div className="flex min-h-44 flex-col items-center justify-center text-violet-200">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-400/70">
                  <i className="fa-solid fa-robot" aria-hidden="true" />
                </div>
                <div className="mt-3 flex h-5 items-end gap-1 text-emerald-300">
                  <span className="h-2 w-1 rounded bg-current" />
                  <span className="h-4 w-1 rounded bg-current" />
                  <span className="h-3 w-1 rounded bg-current" />
                  <span className="h-5 w-1 rounded bg-current" />
                </div>
              </div>
              <span className="rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-500">AI interviewer</span>
            </div>
            <div className="min-h-60 rounded-lg border border-white/10 bg-[#080c13] p-4">
              <div className="flex justify-end">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">Good</span>
              </div>
              <div className="flex min-h-44 flex-col items-center justify-center text-slate-700">
                <i className="fa-solid fa-video text-2xl" aria-hidden="true" />
                <span className="mt-2 text-xs font-semibold">Camera feed</span>
              </div>
              <span className="rounded bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-500">You</span>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-violet-400/10 bg-[#111527] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-violet-300">Current question - Q3 of 14</p>
            <p className="mt-2 text-sm font-medium text-slate-200">Can you explain how you would design a RESTful API for a real-time notification system?</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Features</p>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-5xl">
              Everything you need to <span className="text-violet-400">ace the interview</span>
            </h2>
            <p className="mt-5 text-base font-medium leading-7 text-slate-500">
              IntervueAI simulates a real interview, not just a quiz. Every session is unique to your resume and role.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                to="/login"
                className="rounded-xl border border-white/10 bg-slate-900/60 p-6 transition hover:border-violet-400/50 hover:bg-slate-900"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${feature.tone}`}>
                  <i className={feature.iconClass} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-base font-black text-white">{feature.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">How it works</p>
          <h2 className="mt-4 text-3xl font-black text-white sm:text-5xl">
            From signup to <span className="text-emerald-300">feedback in minutes</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-slate-500">
            No setup. No coaching. Just you, your resume, and an AI that challenges you.
          </p>

          <div className="relative mt-16 grid gap-8 md:grid-cols-5">
            <div className="absolute left-16 right-16 top-7 hidden h-px bg-white/10 md:block" />
            {steps.map((step) => (
              <div key={step.title} className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-slate-950 text-violet-300">
                  <i className={step.iconClass} aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-sm font-black text-white">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-40 text-xs font-semibold leading-5 text-slate-500">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tracks" className="border-t border-white/10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Interview tracks</p>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-5xl">
              6 roles, <span className="text-violet-400">one platform</span>
            </h2>
            <p className="mt-5 text-base font-medium leading-7 text-slate-500">
              Pick your target role and practice with questions tailored to that tech stack.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {interviewTracks.map((track) => (
              <Link
                key={track.id}
                to="/login"
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-violet-400/50 hover:bg-slate-900"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${trackIconStyles[track.id]}`}>
                  <i className={track.iconClass} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-white">{track.title}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">{track.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${difficultyStyles[track.difficulty]}`}>
                  {track.difficulty}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-violet-400/10 bg-gradient-to-br from-violet-950/40 via-slate-900 to-emerald-950/30 px-6 py-16 text-center">
          <h2 className="text-3xl font-black text-white sm:text-5xl">
            Ready to <span className="text-violet-400">ace it?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-7 text-slate-400">
            Start your first AI mock interview for free. No credit card. No downloads. Just practice that actually prepares you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-6 text-sm font-bold text-white hover:border-violet-400/60 sm:w-auto">
              <i className="fa-solid fa-play" aria-hidden="true" />
              Start free interview
            </Link>
            <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-bold text-white hover:border-emerald-400/60 sm:w-auto">
              See demo
            </Link>
          </div>
          <p className="mt-5 text-xs font-semibold text-slate-600">Free to start - no signup required to preview</p>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs font-semibold text-slate-600 md:flex-row">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500 text-[10px] text-white">
              <i className="fa-solid fa-message" aria-hidden="true" />
            </span>
            IntervueAI
          </Link>
          <p>(c) 2026 IntervueAI. Built with care for job seekers.</p>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-white">Privacy</a>
            <a href="#features" className="hover:text-white">Terms</a>
            <a href="#features" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

export default Landing
