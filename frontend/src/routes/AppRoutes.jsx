import { Route, Routes } from "react-router-dom"
import ProtectedRoute from "../components/ProtectedRoute"
import Dashboard from "../pages/Dashboard"
import InterviewFeedback from "../pages/InterviewFeedback"
import InterviewSetup from "../pages/InterviewSetup"
import InterviewLive from "../pages/InterviewLive"
import Landing from "../pages/Landing"
import Login from "../pages/Login"
import NotFound from "../pages/NotFound"
import Register from "../pages/Register"
import VerifyOtp from "../pages/VerifyOtp"

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview-setup"
        element={
          <ProtectedRoute>
            <InterviewSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/live"
        element={
          <ProtectedRoute>
            <InterviewLive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/feedback"
        element={
          <ProtectedRoute>
            <InterviewFeedback />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default AppRoutes
