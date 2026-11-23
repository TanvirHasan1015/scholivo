import { Link, Navigate, useNavigate } from 'react-router-dom'
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { BrandLogo } from '@/components/common/BrandLogo'
import { Button } from '@/components/common/Button'

export default function SignupRoleSelect() {
  const { user, role, loading } = useAuth()
  const navigate = useNavigate()

  if (!loading && user && (role === 'student' || role === 'professor')) {
    return (
      <Navigate
        to={role === 'professor' ? '/dashboard/professor' : '/dashboard/student'}
        replace
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center flex flex-col items-center space-y-3">
          <BrandLogo iconSize="lg" textSize="lg" showTagline />
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight pt-2">
            Join Scholivo
          </h1>
          <p className="text-slate-500 text-sm max-w-md">
            Choose how you want to participate in the Scholivo academic research network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Student Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs flex flex-col justify-between space-y-6 hover:border-blue-300 transition-colors">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <BookOpen size={22} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Join as a Student
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Create a student academic profile and discover research opportunities.
                </p>
              </div>
            </div>

            <Button
              type="button"
              fullWidth
              size="lg"
              onClick={() => navigate('/signup/student')}
              className="flex items-center justify-center gap-2 shadow-xs"
              id="continue-student-signup-btn"
            >
              <span>Continue as Student</span>
              <ArrowRight size={16} />
            </Button>
          </div>

          {/* Professor Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs flex flex-col justify-between space-y-6 hover:border-indigo-300 transition-colors">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <GraduationCap size={22} />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Join as a Professor
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Create a professor profile and publish research opportunities.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="lg"
              onClick={() => navigate('/signup/professor')}
              className="flex items-center justify-center gap-2 shadow-xs"
              id="continue-professor-signup-btn"
            >
              <span>Continue as Professor</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
            >
              Sign in to Scholivo
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
