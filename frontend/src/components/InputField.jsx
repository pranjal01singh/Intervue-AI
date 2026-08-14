const InputField = ({
  label,
  name,
  type = "text",
  register,
  error,
  className = "",
  ...props
}) => {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={name}
        type={type}
        {...register(name)}
        className={`w-full rounded-lg border bg-slate-800 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-900/50 ${
          error ? "border-rose-500" : "border-slate-700"
        }`}
        {...props}
      />
      {error && <p className="mt-2 text-left text-sm text-rose-400">{error.message}</p>}
    </div>
  )
}

export default InputField
