import axios from "axios"

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
})

axiosInstance.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"]
    delete config.headers["content-type"]
  }

  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("token")
      sessionStorage.removeItem("user")
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
