const Button = ({
  children,
  type = "button",
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) => {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary: "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500",
    ghost: "bg-transparent text-indigo-700 hover:bg-indigo-50 focus:ring-indigo-400",
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  )
}

export default Button
