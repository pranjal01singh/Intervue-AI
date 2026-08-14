import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/useAuth"
import Loader from "./Loader"

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loader label="Checking session" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
