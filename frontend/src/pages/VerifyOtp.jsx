import { Link, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { useMemo, useState } from "react"
import Button from "../components/Button"
import InputField from "../components/InputField"
import { resendOtp, verifyOtp } from "../services/authService"

const VerifyOtp = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const email = useMemo(
    () => location.state?.email || localStorage.getItem("pendingVerificationEmail"),
    [location.state]
  )
  const [apiError, setApiError] = useState("")
  const [message, setMessage] = useState("")
  const [resending, setResending] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async ({ otp }) => {
    setApiError("")
    setMessage("")

    if (!email) {
      setApiError("Please register again so we know which email to verify.")
      return
    }

    try {
      const data = await verifyOtp({ email, otp })
      localStorage.removeItem("pendingVerificationEmail")
      setMessage(data.message)
      navigate("/login")
    } catch (error) {
      setApiError(error.response?.data?.message || "OTP verification failed")
    }
  }

  const handleResend = async () => {
    setApiError("")
    setMessage("")

    if (!email) {
      setApiError("Please register again so we know where to send the OTP.")
      return
    }

    try {
      setResending(true)
      const data = await resendOtp({ email })
      setMessage(data.message)
    } catch (error) {
      setApiError(error.response?.data?.message || "Could not resend OTP")
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/20">
        <div className="mb-6 text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Email verification</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Enter your OTP</h1>
          <p className="mt-3 text-sm text-slate-400">
            We sent a 6-digit OTP to {email || "your registered email"}.
          </p>
        </div>

        {apiError && <div className="mb-4 rounded-lg bg-rose-950/50 px-4 py-3 text-sm text-rose-400 border border-rose-800">{apiError}</div>}
        {message && <div className="mb-4 rounded-lg bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400 border border-emerald-800">{message}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <InputField
            label="OTP"
            name="otp"
            inputMode="numeric"
            maxLength={6}
            register={(name) =>
              register(name, {
                required: "OTP is required",
                pattern: { value: /^\d{6}$/, message: "OTP must be 6 digits" },
              })
            }
            error={errors.otp}
            placeholder="123456"
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Verify OTP
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-3 text-center text-sm sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" loading={resending} onClick={handleResend} className="px-3 text-slate-300 hover:text-white">
            Resend OTP
          </Button>
          <Link to="/login" className="font-semibold text-slate-300 hover:text-slate-100">
            Back to login
          </Link>
        </div>
      </section>
    </main>
  )
}

export default VerifyOtp
