import { Link } from "react-router-dom"
import Button from "../components/Button"

const NotFound = () => {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-indigo-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">The page you are looking for does not exist.</p>
        <Link to="/dashboard" className="mt-6 inline-flex">
          <Button>Go to dashboard</Button>
        </Link>
      </section>
    </main>
  )
}

export default NotFound
