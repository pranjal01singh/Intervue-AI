import { useMemo, useState } from "react"
import { loginUser, logoutUser } from "../services/authService"
import AuthContext from "./authContextValue"

const getStoredAuth = () => {
  localStorage.removeItem("token")
  localStorage.removeItem("user")

  const storedToken = sessionStorage.getItem("token")
  const storedUser = sessionStorage.getItem("user")

  if (!storedToken || !storedUser) {
    return { token: null, user: null }
  }

  try {
    return { token: storedToken, user: JSON.parse(storedUser) }
  } catch {
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("user")
    return { token: null, user: null }
  }
}

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(getStoredAuth)

  const login = async (credentials) => {
    const data = await loginUser(credentials)

    sessionStorage.setItem("token", data.token)
    sessionStorage.setItem("user", JSON.stringify(data.user))
    setAuth({ token: data.token, user: data.user })

    return data
  }

  const logout = () => {
    logoutUser()
    setAuth({ token: null, user: null })
  }

  const value = useMemo(
    () => ({
      user: auth.user,
      token: auth.token,
      loading: false,
      login,
      logout,
      isAuthenticated: Boolean(auth.token && auth.user),
    }),
    [auth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
