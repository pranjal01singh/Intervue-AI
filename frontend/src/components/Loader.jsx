const Loader = ({ label = "Loading" }) => {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-sm font-medium text-gray-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      <span>{label}</span>
    </div>
  )
}

export default Loader
