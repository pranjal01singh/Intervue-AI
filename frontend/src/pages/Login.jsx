import { Link, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { useState } from "react"
import Button from "../components/Button"
import InputField from "../components/InputField"
import { useAuth } from "../context/useAuth"

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [apiError, setApiError] = useState("")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (formData) => {
    setApiError("")

    try {
      await login(formData)
      const redirectTo = location.state?.from?.pathname || "/dashboard"
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setApiError(error.response?.data?.message || "Login failed")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/20">
        <div className="mb-6 text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Log in to continue</h1>
          <p className="mt-3 text-sm text-slate-400">
            Access your mock interview dashboard and future interview reports.
          </p>
        </div>

        {apiError && <div className="mb-4 rounded-lg bg-rose-950/50 px-4 py-3 text-sm text-rose-400 border border-rose-800">{apiError}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <InputField
            label="Email"
            name="email"
            type="email"
            register={(name) =>
              register(name, {
                required: "Email is required",
                pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email" },
              })
            }
            error={errors.email}
            placeholder="you@example.com"
          />
          <InputField
            label="Password"
            name="password"
            type="password"
            register={(name) =>
              register(name, {
                required: "Password is required",
                minLength: { value: 8, message: "Password must be at least 8 characters" },
              })
            }
            error={errors.password}
            placeholder="Your password"
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New here?{" "}
          <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Create an account
          </Link>
        </p>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:border-indigo-400 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  )
}

export default Login
