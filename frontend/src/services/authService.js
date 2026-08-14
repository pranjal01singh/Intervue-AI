import axiosInstance from "./axiosInstance"

export const registerUser = async (payload) => {
  const { data } = await axiosInstance.post("/auth/register", payload)
  return data
}

export const verifyOtp = async (payload) => {
  const { data } = await axiosInstance.post("/auth/verify-otp", payload)
  return data
}

export const resendOtp = async (payload) => {
  const { data } = await axiosInstance.post("/auth/resend-otp", payload)
  return data
}

export const loginUser = async (payload) => {
  const { data } = await axiosInstance.post("/auth/login", payload)
  return data
}

export const logoutUser = () => {
  sessionStorage.removeItem("token")
  sessionStorage.removeItem("user")
  localStorage.removeItem("token")
  localStorage.removeItem("user")
}
