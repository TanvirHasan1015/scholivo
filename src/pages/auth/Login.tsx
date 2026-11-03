import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isDemoMode } from '@/lib/firebase'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const { signIn, role } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setAuthError('')
    try {
      await signIn(data.email, data.password)
      setTimeout(() => {
        const currentRole = role
        if (currentRole === 'professor') navigate('/dashboard/professor')
        else navigate('/dashboard/student')
      }, 100)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password. Please try again.')
      } else {
        setAuthError('Sign in failed. Please try again.')
      }
    }
  }

  const handleDemoSignIn = async () => {
    setAuthError('')
    try {
      await signIn('alex.rivera@university.edu', 'demo123')
      navigate('/dashboard/student')
    } catch {
      setAuthError('Demo sign in failed.')
    }
  }

  const handleDemoProfSignIn = async () => {
    setAuthError('')
    try {
      await signIn('prof.kim@kaist.ac.kr', 'demo123')
      navigate('/dashboard/professor')
    } catch {
      setAuthError('Demo professor sign in failed.')
    }
  }

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

            {authError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-semibold text-red-600">
                {authError}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2 shadow-xs">
              Sign In
            </Button>
          </form>

          {isDemoMode && (
            <div className="pt-2 space-y-2">
              <Button
                type="button"
                variant="outline"
                fullWidth
                size="md"
                onClick={handleDemoSignIn}
                className="flex items-center justify-center gap-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 hover:bg-blue-50 cursor-pointer font-semibold"
                id="demo-student-login-btn"
              >
                <Sparkles size={14} className="text-blue-600" />
                <span>Quick Sign-in as Demo Student (Alex)</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                fullWidth
                size="md"
                onClick={handleDemoProfSignIn}
                className="flex items-center justify-center gap-2 border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 cursor-pointer font-semibold"
                id="demo-professor-login-btn"
              >
                <Sparkles size={14} className="text-indigo-600" />
                <span>Quick Sign-in as Demo Professor (Prof. Kim)</span>
              </Button>
            </div>
          )}

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
