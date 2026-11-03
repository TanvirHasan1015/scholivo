import { Navigate, Outlet } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/user.types'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-slate-500 text-xs font-medium">Loading session…</p>
        </div>
      </div>
    )
  }

  if (!user || (role !== 'student' && role !== 'professor')) {
    return <Navigate to="/login" replace />
  }

  // Check if current user's account is suspended
  const checkIsSuspended = (): boolean => {
    if (!user) return false
    const savedSuspended = localStorage.getItem('rm_demo_suspended_uids')
    if (savedSuspended) {
      try {
        const uids: string[] = JSON.parse(savedSuspended)
        if (uids.includes(user.uid) || (user.email && uids.includes(user.email))) {
          return true
        }
      } catch {}
    }
    const savedUsers = localStorage.getItem('rm_demo_system_users')
    if (savedUsers) {
      try {
        const usersList: { uid: string; email: string; accountStatus: string }[] = JSON.parse(savedUsers)
        const match = usersList.find((u) => u.uid === user.uid || u.email === user.email)
        if (match && match.accountStatus === 'suspended') return true
      } catch {}
    }
    return false
  }

  if (checkIsSuspended()) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-28 pb-20 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 p-8 shadow-md text-center space-y-5 animate-scaleUp">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={36} />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 inline-block mb-2">
              Account Suspended
            </span>
            <h1 className="text-xl font-bold font-display text-slate-900 tracking-tight">
              Access Temporarily Restricted
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Your Scholivo account ({user.displayName} • {user.email}) has been suspended by an administrator for compliance or verification review. Access to protected student and faculty services is temporarily disabled.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-left space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Account ID:</span>
              <span className="font-mono text-slate-700">{user.uid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account Status:</span>
              <span className="font-semibold text-rose-600">Suspended</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              id="suspended-signout-btn"
            >
              Sign Out of Account
            </button>
            <a
              href="mailto:support@scholivo.edu"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Contact Administrative Support &rarr;
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard
    if (role === 'professor') return <Navigate to="/dashboard/professor" replace />
    return <Navigate to="/dashboard/student" replace />
  }

  return <Outlet />
}
