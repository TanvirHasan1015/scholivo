import { Link } from 'react-router-dom'
import { BookOpen, Home } from 'lucide-react'
import { Button } from '@/components/common/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-hero-gradient text-center">
      <div className="glass max-w-md w-full p-8 rounded-3xl border border-white/10 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <BookOpen size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-white font-display">404</h1>
          <p className="text-lg font-semibold text-slate-200 mt-2">Page Not Found</p>
          <p className="text-xs text-slate-400 mt-1">
            The research position, professor profile, or dashboard page you requested does not exist or has moved.
          </p>
        </div>
        <Link to="/">
          <Button className="w-full flex items-center justify-center gap-2">
            <Home size={16} /> Return to Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
