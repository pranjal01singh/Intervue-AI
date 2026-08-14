import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { useState } from "react"
import Button from "../components/Button"
import InputField from "../components/InputField"
import { registerUser } from "../services/authService"

const Register = () => {
  const navigate = useNavigate()
  const [apiError, setApiError] = useState("")
  const [message, setMessage] = useState("")
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (formData) => {
    setApiError("")
    setMessage("")

    try {
      const data = await registerUser(formData)
      localStorage.setItem("pendingVerificationEmail", data.email)
      setMessage(data.message)
      navigate("/verify-otp", { state: { email: data.email } })
    } catch (error) {
      setApiError(error.response?.data?.message || "Registration failed")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/20">
        <div className="mb-6 text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Candidate access</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Create your account</h1>
          <p className="mt-3 text-sm text-slate-400">
            Join the AI Mock Interview Platform and verify your email to continue.
          </p>
        </div>

        {apiError && <div className="mb-4 rounded-lg bg-rose-950/50 px-4 py-3 text-sm text-rose-400 border border-rose-800">{apiError}</div>}
        {message && <div className="mb-4 rounded-lg bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400 border border-emerald-800">{message}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <InputField
            label="Name"
            name="name"
            register={(name) =>
              register(name, {
                required: "Name is required",
                minLength: { value: 2, message: "Name must be at least 2 characters" },
              })
            }
            error={errors.name}
            placeholder="Pranjal Singh"
          />
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
            placeholder="Minimum 8 characters"
          />
          <InputField
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            register={(name) =>
              register(name, {
                required: "Confirm password is required",
                validate: (value) => value === getValues("password") || "Passwords do not match",
              })
            }
            error={errors.confirmPassword}
            placeholder="Repeat your password"
          />
          <Button type="submit" loading={isSubmitting} className="w-full">
            Register
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-indigo-700 hover:text-indigo-800">
            Log in
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

export default Register
