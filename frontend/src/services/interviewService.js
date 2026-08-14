import axiosInstance from "./axiosInstance"

export const uploadResume = async (file) => {
  const formData = new FormData()
  formData.append("resume", file)

  const { data } = await axiosInstance.post("/interview/resume", formData)
  return data
}

export const startInterview = async ({ trackId, trackTitle, mode, resumeUrl }) => {
  const { data } = await axiosInstance.post("/interview/start", {
    trackId,
    trackTitle,
    mode,
    resumeUrl,
  })
  return data
}

export const sendMediaPermission = async ({ camera, microphone }) => {
  const { data } = await axiosInstance.post("/interview/permissions", { camera, microphone })
  return data
}

export const requestFollowUpQuestion = async ({ interviewId, questionIndex, answer }) => {
  const { data } = await axiosInstance.post("/interview/follow-up", { interviewId, questionIndex, answer })
  return data
}

export const endInterview = async ({ interviewId, answeredCount, durationSeconds }) => {
  const { data } = await axiosInstance.post("/interview/end", { interviewId, answeredCount, durationSeconds })
  return data
}

export const endInterviewWithTranscripts = async ({ interviewId, answeredCount, durationSeconds, transcripts, visualMetrics, isCheat = false }) => {
  const { data } = await axiosInstance.post("/interview/end", { interviewId, answeredCount, durationSeconds, transcripts, visualMetrics, isCheat })
  return data
}

export const getInterviewHistory = async () => {
  const { data } = await axiosInstance.get("/interview/history")
  return data
}

export const getInterviewDetails = async (interviewId) => {
  const { data } = await axiosInstance.get(`/interview/details/${interviewId}`)
  return data
}

export const getCompletedInterviewCacheKey = (user) =>
  `completedInterviews:${user?._id || user?.id || user?.email || "default"}`

export const getCachedCompletedInterviews = (user) => {
  try {
    return JSON.parse(sessionStorage.getItem(getCompletedInterviewCacheKey(user)) || "[]")
  } catch {
    return []
  }
}

export const cacheCompletedInterview = (interview, user) => {
  if (!interview?._id) return

  const cacheKey = getCompletedInterviewCacheKey(user)
  const cached = getCachedCompletedInterviews(user)
  const completedInterview = {
    ...interview,
    status: interview.status || "completed",
    completedAt: interview.completedAt || new Date().toISOString(),
    updatedAt: interview.updatedAt || new Date().toISOString(),
  }
  const next = [completedInterview, ...cached.filter((item) => item?._id !== interview._id)].slice(0, 12)
  sessionStorage.setItem(cacheKey, JSON.stringify(next))
}
