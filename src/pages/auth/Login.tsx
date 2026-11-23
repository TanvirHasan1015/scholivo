import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const { user, role, loading, sessionError, retrySession, signIn, logout } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // If already authenticated with a valid authoritative role, redirect straight to the user's dashboard
  if (!loading && user && (role === 'student' || role === 'professor')) {
    return (
      <Navigate
        to={role === 'professor' ? '/dashboard/professor' : '/dashboard/student'}
        replace
      />
    )
  }

  const onSubmit = async (data: FormData) => {
    setAuthError('')
    try {
      const resolvedRole = await signIn(data.email, data.password)
      if (resolvedRole === 'professor') {
        navigate('/dashboard/professor', { replace: true })
      } else if (resolvedRole === 'student') {
        navigate('/dashboard/student', { replace: true })
      } else {
        setAuthError('Your account profile setup is incomplete. Please complete registration on the sign-up page.')
      }
    } catch (err: unknown) {
      const code = ((err as { code?: string })?.code || '').toLowerCase()
      const msg = ((err as { message?: string })?.message || '').toLowerCase()
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setAuthError('Invalid email or password. Please try again.')
      } else if (code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.')
      } else if (code === 'auth/user-disabled') {
        setAuthError('This account has been disabled. Please contact support.')
      } else if (code === 'auth/too-many-requests') {
        setAuthError('Too many failed attempts. Please wait a few minutes and try again.')
      } else if (
        code === 'auth/network-request-failed' ||
        code.includes('unavailable') ||
        code.includes('deadline-exceeded') ||
        msg.includes('offline') ||
        msg.includes('network')
      ) {
        setAuthError('Network error while signing in. Please check your connection and try again.')
      } else {
        setAuthError('Sign in failed. Please try again.')
      }
    }
  }

  const handleRetrySession = async () => {
    setRetrying(true)
    try {
      await retrySession()
    } finally {
      setRetrying(false)
    }
  }

  const displayError = authError || sessionError

  return (
    <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo */}
        <div className="text-center flex justify-center">
          <BrandLogo iconSize="lg" textSize="lg" showTagline />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to your Scholivo account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" id="login-form">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@university.edu"
              leftIcon={<Mail size={15} />}
              error={errors.email?.message}
              {...register('email')}
              id="login-email"
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Your password"
              leftIcon={<Lock size={15} />}
              rightIcon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} className="cursor-pointer">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              error={errors.password?.message}
              {...register('password')}
              id="login-password"
            />

            {displayError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-600 space-y-2">
                <p>{displayError}</p>
                {user && !role && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={retrying}
                      onClick={handleRetrySession}
                      className="text-xs"
                    >
                      Retry Session
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => logout()}
                      className="text-xs text-red-700"
                    >
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2 shadow-xs">
              Sign In
            </Button>
          </form>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-center text-xs text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup/student" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Sign up as Student
              </Link>{' '}
              or{' '}
              <Link to="/signup/professor" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                Professor
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
