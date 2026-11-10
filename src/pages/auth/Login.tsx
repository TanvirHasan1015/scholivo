import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, GraduationCap, BookOpen, LogOut, Link2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/user.types'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

function getDashboardPath(targetRole: UserRole | null): string {
  if (targetRole === 'professor') return '/dashboard/professor'
  if (targetRole === 'admin') return '/admin'
  return '/dashboard/student'
}

function getGoogleErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code
  const message = (err as { message?: string })?.message

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled before completion.'
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists using Email & Password. Please sign in with your password below to link your Google account.'
    case 'auth/network-request-failed':
      return 'Network error while connecting to Firebase. Please check your internet connection and try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.'
    case 'auth/inconsistent-account-records':
      return message || 'Inconsistent account records were found. Please contact support.'
    default:
      return 'Google sign-in failed. Please check your Firebase configuration and try again.'
  }
}

export default function Login() {
  const {
    user,
    role,
    signIn,
    signInWithGoogle,
    pendingGoogleLink,
    linkPendingGoogleCredential,
    clearPendingGoogleLink,
    logout,
  } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isLinkingLoading, setIsLinkingLoading] = useState(false)
  const [awaitingRoleSelection, setAwaitingRoleSelection] = useState(false)
  const [awaitingLinkConfirmation, setAwaitingLinkConfirmation] = useState(false)
  const [postLinkRole, setPostLinkRole] = useState<UserRole | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setAuthError('')
    try {
      const resolvedRole = await signIn(data.email, data.password)
      if (
        pendingGoogleLink &&
        (!pendingGoogleLink.email ||
          pendingGoogleLink.email.toLowerCase() === data.email.trim().toLowerCase())
      ) {
        setPostLinkRole(resolvedRole)
        setAwaitingLinkConfirmation(true)
        return
      }
      navigate(getDashboardPath(resolvedRole))
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password. Please try again.')
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error. Please check your internet connection and try again.')
      } else if (code === 'auth/too-many-requests') {
        setAuthError('Too many failed attempts. Please wait a moment and try again.')
      } else {
        setAuthError('Sign in failed. Please try again.')
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setAuthError('')
    setIsGoogleLoading(true)
    try {
      const result = await signInWithGoogle()

      if (result.accountStatus === 'existing_complete' && result.role) {
        navigate(getDashboardPath(result.role))
        return
      }

      if (result.accountStatus === 'incomplete_onboarding') {
        if (result.role === 'professor') {
          navigate('/signup/professor')
          return
        }
        if (result.role === 'student') {
          navigate('/signup/student')
          return
        }
      }

      setAwaitingRoleSelection(true)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/account-exists-with-different-credential') {
        const conflictEmail = (err as { customData?: { email?: string } })?.customData?.email
        if (conflictEmail) {
          setValue('email', conflictEmail)
        }
      }
      setAuthError(getGoogleErrorMessage(err))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleConfirmAccountLink = async () => {
    setAuthError('')
    setIsLinkingLoading(true)
    try {
      await linkPendingGoogleCredential()
      setAwaitingLinkConfirmation(false)
      navigate(getDashboardPath(postLinkRole || role))
    } catch (err: unknown) {
      setAuthError(
        (err as { message?: string })?.message || 'Failed to link Google account. Please try again.'
      )
    } finally {
      setIsLinkingLoading(false)
    }
  }

  const handleSkipAccountLink = () => {
    clearPendingGoogleLink()
    setAwaitingLinkConfirmation(false)
    navigate(getDashboardPath(postLinkRole || role))
  }

  const handleCancelGoogleOnboarding = async () => {
    setAwaitingRoleSelection(false)
    await logout()
  }

  const showRoleSelector = awaitingRoleSelection || Boolean(user && !role && !awaitingLinkConfirmation)

  return (
    <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center flex justify-center">
          <BrandLogo iconSize="lg" textSize="lg" showTagline />
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs space-y-6">
          {awaitingLinkConfirmation ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                  <Link2 size={20} />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">
                    Link Google Account
                  </h1>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Confirm linking Google Sign-in to your existing account
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                You signed in as <strong className="text-slate-900">{user?.email}</strong>. Would you like to link your Google account so you can sign in with either Google or your password in the future?
              </p>

              {authError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-600">
                  {authError}
                </div>
              )}

              <div className="space-y-2.5">
                <Button
                  type="button"
                  fullWidth
                  size="lg"
                  loading={isLinkingLoading}
                  onClick={handleConfirmAccountLink}
                  id="confirm-google-link-btn"
                >
                  Confirm & Link Google Account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  size="md"
                  onClick={handleSkipAccountLink}
                  id="skip-google-link-btn"
                >
                  Continue Without Linking
                </Button>
              </div>
            </div>
          ) : showRoleSelector ? (
            <div className="space-y-5" id="google-role-selection">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                  Complete Registration
                </span>
                <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                  Choose your role
                </h1>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Signed in with Google as{' '}
                  <strong className="text-slate-800">{user?.email || user?.displayName}</strong>. Select how you are joining Scholivo to complete your profile onboarding:
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigate('/signup/student')}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all flex items-start gap-3.5 cursor-pointer group"
                  id="google-select-student-btn"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700">
                      Continue as Student
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Build your academic profile, discover matched labs, and apply to research positions.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/signup/professor')}
                  className="w-full p-4 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all flex items-start gap-3.5 cursor-pointer group"
                  id="google-select-professor-btn"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                      Continue as Professor
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create your faculty profile, verify institutional affiliation, and recruit researchers.
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCancelGoogleOnboarding}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                id="google-cancel-onboarding-btn"
              >
                <LogOut size={13} />
                <span>Sign out and use a different account</span>
              </button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
                <p className="text-slate-500 text-sm mt-1">Sign in to your Scholivo account</p>
              </div>

              {pendingGoogleLink && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Existing Email/Password Account Detected</p>
                  <p>
                    {pendingGoogleLink.email ? (
                      <>
                        <strong>{pendingGoogleLink.email}</strong> is already registered with Email & Password.
                      </>
                    ) : (
                      'This email is already registered with Email & Password.'
                    )}{' '}
                    Sign in with your password below to verify ownership and link your Google account.
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                fullWidth
                size="lg"
                loading={isGoogleLoading}
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-2.5 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                id="google-signin-btn"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  or
                </span>
                <div className="border-t border-slate-200 w-full" />
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

                {authError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-600">
                    {authError}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
