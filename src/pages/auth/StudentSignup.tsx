import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, GraduationCap, FlaskConical, Code, Languages, FileText, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { Input, Select, Textarea } from '@/components/common/Input'
import { TagInput } from '@/components/common/TagInput'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'
import { RESEARCH_AREAS, COUNTRIES, calculateProfileCompleteness } from '@/utils/helpers'

// ── Validation schema ─────────────────────────────────────────────────────────

const accountSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscore only'),
  email: z.string().email('Enter a valid email'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  country: z.string().min(1, 'Please select your country'),
})

type AccountForm = z.infer<typeof accountSchema>

// ── Steps config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'academic', label: 'Academic', icon: GraduationCap },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'skills', label: 'Skills', icon: Code },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'documents', label: 'Documents', icon: FileText },
]

const DEGREE_OPTIONS = [
  { value: 'Bachelor', label: "Bachelor's" },
  { value: 'Master', label: "Master's" },
  { value: 'PhD', label: 'PhD' },
]

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }))

export default function StudentSignup() {
  const { user, role, signUp, signInWithGoogle, completeGoogleSignUp } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const isGoogleAuth = Boolean(user && !role)

  // Account form (validated step 0)
  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: user?.displayName || '',
      username: '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
      country: '',
    },
  })

  // All extra data stored locally
  const [academic, setAcademic] = useState({
    university: '', department: '', major: '', degree: 'Master', currentSemester: '',
    expectedGraduation: '', gpa: '', gpaScale: '4.0',
  })
  const [research, setResearch] = useState({
    researchInterests: [] as string[], researchAreas: [] as string[], bio: '',
  })
  const [skills, setSkills] = useState({
    programmingLanguages: [] as string[], frameworks: [] as string[],
    technicalSkills: [] as string[], researchTools: [] as string[],
  })
  const [language, setLanguage] = useState({
    ielts: '', toefl: '', topik: '', other: '', otherLabel: '',
  })

  const handleGoogleSignUp = async () => {
    setError('')
    setIsGoogleLoading(true)
    try {
      const result = await signInWithGoogle()

      if (result.accountStatus === 'existing_complete' && result.role) {
        if (result.role === 'professor') navigate('/dashboard/professor')
        else if (result.role === 'admin') navigate('/admin')
        else navigate('/dashboard/student')
        return
      }

      if (result.accountStatus === 'incomplete_onboarding' && result.role === 'professor') {
        navigate('/signup/professor')
        return
      }

      if (result.user.displayName) {
        accountForm.setValue('fullName', result.user.displayName, { shouldValidate: true })
      }
      if (result.user.email) {
        accountForm.setValue('email', result.user.email, { shouldValidate: true })
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const message = (err as { message?: string })?.message
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google sign-in was cancelled before completion.')
      } else if (code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups and try again.')
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists using Email & Password. Please sign in on the Login page to link your Google account.')
      } else if (code === 'auth/inconsistent-account-records') {
        setError(message || 'Inconsistent account records found. Please contact support.')
      } else {
        setError('Google sign-in failed. Please try again.')
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleNext = async () => {
    if (currentStep === 0) {
      const baseValid = await accountForm.trigger(['fullName', 'username', 'email', 'country'])
      if (!baseValid) return

      if (!isGoogleAuth) {
        const pwd = accountForm.getValues('password') || ''
        const confirmPwd = accountForm.getValues('confirmPassword') || ''
        if (pwd.length < 8) {
          accountForm.setError('password', { message: 'Password must be at least 8 characters' })
          return
        }
        if (pwd !== confirmPwd) {
          accountForm.setError('confirmPassword', { message: 'Passwords do not match' })
          return
        }
      }
    }
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const accountData = accountForm.getValues()
      const activeUser = isGoogleAuth
        ? await completeGoogleSignUp(accountData.fullName, 'student')
        : await signUp(accountData.email, accountData.password || '', accountData.fullName, 'student')

      // Never overwrite an existing student profile
      const existingProfileSnap = await getDoc(doc(db, 'students', activeUser.uid))
      if (existingProfileSnap.exists()) {
        navigate('/dashboard/student')
        return
      }

      const languageScores = []
      if (language.ielts) languageScores.push({ id: 'ielts', type: 'IELTS' as const, score: language.ielts })
      if (language.toefl) languageScores.push({ id: 'toefl', type: 'TOEFL' as const, score: language.toefl })
      if (language.topik) languageScores.push({ id: 'topik', type: 'TOPIK' as const, score: language.topik })
      if (language.other && language.otherLabel) languageScores.push({ id: 'other', type: 'Other' as const, score: language.other, label: language.otherLabel })

      const draftStudentProfile = {
        uid: activeUser.uid,
        fullName: accountData.fullName.trim(),
        username: accountData.username.trim(),
        email: activeUser.email || accountData.email.trim(),
        photoURL: activeUser.photoURL || undefined,
        country: accountData.country,
        university: academic.university.trim(),
        department: academic.department.trim(),
        major: academic.major.trim(),
        degree: (academic.degree || 'Bachelor') as 'Bachelor' | 'Master' | 'PhD',
        currentSemester: academic.currentSemester.trim(),
        expectedGraduation: academic.expectedGraduation,
        gpa: parseFloat(academic.gpa) || 0,
        gpaScale: parseFloat(academic.gpaScale) || 4.0,
        researchInterests: research.researchInterests,
        researchAreas: research.researchAreas,
        bio: research.bio.trim(),
        researchExperience: [],
        projects: [],
        publications: [],
        programmingLanguages: skills.programmingLanguages,
        frameworks: skills.frameworks,
        technicalSkills: skills.technicalSkills,
        researchTools: skills.researchTools,
        languageScores,
        verificationStatus: 'pending' as const,
        accountStatus: 'active' as const,
        profileCompleteness: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      draftStudentProfile.profileCompleteness = calculateProfileCompleteness(draftStudentProfile)

      await setDoc(doc(db, 'students', activeUser.uid), {
        ...draftStudentProfile,
        photoURL: activeUser.photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      navigate('/dashboard/student')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      const message = (err as { message?: string })?.message
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in.')
      } else if (
        code === 'auth/inconsistent-account-records' ||
        code === 'auth/profile-already-exists' ||
        code === 'auth/role-conflict'
      ) {
        setError(message || 'Account conflict detected. Please sign in or contact support.')
      } else {
        setError('Sign up failed. Please check your connection and try again.')
        console.error(err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-hero-gradient py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-6">
            <BrandLogo variant="dark" iconSize="lg" textSize="xl" showTagline />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-1">Create Student Account</h1>
          <p className="text-slate-400 text-sm">Build your academic profile to connect with leading research labs on Scholivo</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isActive = i === currentStep
            const isDone = i < currentStep
            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-indigo-500 ring-4 ring-indigo-500/25' : isDone ? 'bg-indigo-600' : 'bg-white/8 border border-white/15'}`}>
                    <Icon size={14} className={isActive || isDone ? 'text-white' : 'text-slate-600'} />
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? 'text-indigo-300' : isDone ? 'text-slate-400' : 'text-slate-700'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-all ${isDone ? 'bg-indigo-600' : 'bg-white/8'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step content */}
        <div className="glass-strong rounded-3xl border border-white/10 p-7 shadow-2xl">
          {/* Step 0: Account */}
          {currentStep === 0 && (
            <div className="space-y-4 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-5">Account Information</h2>

              {isGoogleAuth ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 flex items-center gap-3 text-xs text-emerald-300">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    Connected with Google as <strong>{user?.email}</strong>. Complete your account details below.
                  </span>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    loading={isGoogleLoading}
                    onClick={handleGoogleSignUp}
                    className="flex items-center justify-center gap-2.5 cursor-pointer"
                    id="student-google-signup-btn"
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

                  <div className="relative flex items-center justify-center py-1">
                    <div className="border-t border-white/10 w-full" />
                    <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      or register with email
                    </span>
                    <div className="border-t border-white/10 w-full" />
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <Input label="Full Name" placeholder="Dr. Jane Smith" required {...accountForm.register('fullName')} error={accountForm.formState.errors.fullName?.message} id="signup-fullname" />
              <Input label="Username" placeholder="janesmith" required {...accountForm.register('username')} error={accountForm.formState.errors.username?.message} id="signup-username" hint="Letters, numbers, underscore only. Cannot be changed later." />
              <Input label="Email Address" type="email" placeholder="jane@university.edu" required readOnly={isGoogleAuth} {...accountForm.register('email')} error={accountForm.formState.errors.email?.message} id="signup-email" />
              <Select label="Country" options={COUNTRY_OPTIONS} placeholder="Select your country" required {...accountForm.register('country')} error={accountForm.formState.errors.country?.message} id="signup-country" />
              {!isGoogleAuth && (
                <>
                  <Input label="Password" type="password" placeholder="At least 8 characters" required {...accountForm.register('password')} error={accountForm.formState.errors.password?.message} id="signup-password" />
                  <Input label="Confirm Password" type="password" placeholder="Repeat your password" required {...accountForm.register('confirmPassword')} error={accountForm.formState.errors.confirmPassword?.message} id="signup-confirm-password" />
                </>
              )}
            </div>
          )}

          {/* Step 1: Academic */}
          {currentStep === 1 && (
            <div className="space-y-4 fade-in-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white text-lg">Academic Information</h2>
                <span className="text-xs text-slate-500">Optional — can complete later</span>
              </div>
              <Input label="University" placeholder="e.g., KAIST, MIT, Seoul National University" value={academic.university} onChange={(e) => setAcademic({ ...academic, university: e.target.value })} id="signup-university" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Department" placeholder="e.g., Computer Science" value={academic.department} onChange={(e) => setAcademic({ ...academic, department: e.target.value })} id="signup-department" />
                <Input label="Major" placeholder="e.g., AI & Machine Learning" value={academic.major} onChange={(e) => setAcademic({ ...academic, major: e.target.value })} id="signup-major" />
              </div>
              <Select label="Current Degree" options={DEGREE_OPTIONS} value={academic.degree} onChange={(e) => setAcademic({ ...academic, degree: e.target.value })} id="signup-degree" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Current Semester/Year" placeholder="e.g., 3rd semester" value={academic.currentSemester} onChange={(e) => setAcademic({ ...academic, currentSemester: e.target.value })} id="signup-semester" />
                <Input label="Expected Graduation" type="month" value={academic.expectedGraduation} onChange={(e) => setAcademic({ ...academic, expectedGraduation: e.target.value })} id="signup-graduation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="GPA / CGPA" type="number" step="0.01" placeholder="3.85" value={academic.gpa} onChange={(e) => setAcademic({ ...academic, gpa: e.target.value })} id="signup-gpa" />
                <Select label="GPA Scale" options={[{ value: '4.0', label: '4.0' }, { value: '4.5', label: '4.5' }, { value: '5.0', label: '5.0' }, { value: '100', label: '100' }]} value={academic.gpaScale} onChange={(e) => setAcademic({ ...academic, gpaScale: e.target.value })} id="signup-gpa-scale" />
              </div>
            </div>
          )}

          {/* Step 2: Research */}
          {currentStep === 2 && (
            <div className="space-y-5 fade-in-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white text-lg">Research Information</h2>
                <span className="text-xs text-slate-500">Used for matching</span>
              </div>
              <TagInput
                label="Research Interests"
                tags={research.researchInterests}
                onChange={(tags) => setResearch({ ...research, researchInterests: tags })}
                suggestions={RESEARCH_AREAS}
                placeholder="e.g., Computer Vision, NLP…"
                hint="These are used to match you with professors. Add as many as relevant."
              />
              <TagInput
                label="Research Areas"
                tags={research.researchAreas}
                onChange={(tags) => setResearch({ ...research, researchAreas: tags })}
                suggestions={RESEARCH_AREAS}
                placeholder="e.g., Artificial Intelligence…"
              />
              <Textarea
                label="Brief Bio / Research Statement"
                placeholder="Describe your research background and interests in a few sentences…"
                rows={4}
                value={research.bio}
                onChange={(e) => setResearch({ ...research, bio: e.target.value })}
                showCount maxLength={500}
                id="signup-bio"
              />
            </div>
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <div className="space-y-5 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-5">Technical Skills</h2>
              <TagInput
                label="Programming Languages"
                tags={skills.programmingLanguages}
                onChange={(tags) => setSkills({ ...skills, programmingLanguages: tags })}
                suggestions={['Python', 'R', 'MATLAB', 'C++', 'Java', 'JavaScript', 'Julia', 'Go', 'Rust', 'Scala', 'SQL']}
                placeholder="Python, R, MATLAB…"
              />
              <TagInput
                label="Frameworks & Libraries"
                tags={skills.frameworks}
                onChange={(tags) => setSkills({ ...skills, frameworks: tags })}
                suggestions={['PyTorch', 'TensorFlow', 'Keras', 'Scikit-learn', 'OpenCV', 'Hugging Face', 'CUDA', 'JAX', 'ROS', 'React', 'Node.js']}
                placeholder="PyTorch, TensorFlow, OpenCV…"
              />
              <TagInput
                label="Technical Skills"
                tags={skills.technicalSkills}
                onChange={(tags) => setSkills({ ...skills, technicalSkills: tags })}
                suggestions={['Deep Learning', 'Computer Vision', 'NLP', 'Data Analysis', 'Statistics', 'Signal Processing', 'Reinforcement Learning', 'Cloud Computing', 'Docker', 'Git']}
                placeholder="Deep Learning, Data Analysis…"
              />
              <TagInput
                label="Research Tools"
                tags={skills.researchTools}
                onChange={(tags) => setSkills({ ...skills, researchTools: tags })}
                suggestions={['LaTeX', 'SPSS', 'STATA', 'Jupyter', 'Linux', 'AWS', 'GCP', 'Overleaf', 'Mendeley', 'MATLAB']}
                placeholder="LaTeX, Jupyter, Linux…"
              />
            </div>
          )}

          {/* Step 4: Language */}
          {currentStep === 4 && (
            <div className="space-y-5 fade-in-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white text-lg">Language Scores</h2>
                <span className="text-xs text-slate-500">Optional</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IELTS Score" type="number" step="0.5" min="0" max="9" placeholder="7.5" value={language.ielts} onChange={(e) => setLanguage({ ...language, ielts: e.target.value })} id="signup-ielts" hint="0–9 scale" />
                <Input label="TOEFL Score" type="number" min="0" max="120" placeholder="100" value={language.toefl} onChange={(e) => setLanguage({ ...language, toefl: e.target.value })} id="signup-toefl" hint="0–120 scale" />
                <Input label="TOPIK Level" type="number" min="1" max="6" placeholder="4" value={language.topik} onChange={(e) => setLanguage({ ...language, topik: e.target.value })} id="signup-topik" hint="Level 1–6" />
                <Input label="Other Language" placeholder="Score" value={language.other} onChange={(e) => setLanguage({ ...language, other: e.target.value })} id="signup-other-lang-score" />
              </div>
              {language.other && (
                <Input label="Other Language Name" placeholder="e.g., GRE, JLPT, HSK…" value={language.otherLabel} onChange={(e) => setLanguage({ ...language, otherLabel: e.target.value })} id="signup-other-lang-label" />
              )}
            </div>
          )}

          {/* Step 5: Documents */}
          {currentStep === 5 && (
            <div className="space-y-5 fade-in-up">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-white text-lg">Documents</h2>
                <span className="text-xs text-slate-500">Can be added later</span>
              </div>
              <div className="glass rounded-2xl border border-white/8 p-5 text-center">
                <FileText size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-1">CV / Resume</p>
                <p className="text-xs text-slate-600 mb-4">You can upload your CV after creating your account from your profile page.</p>
                <Button variant="secondary" size="sm" type="button">Upload CV (PDF)</Button>
              </div>
              <div className="glass rounded-2xl border border-white/8 p-5 text-center">
                <FileText size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-1">Academic Transcript</p>
                <p className="text-xs text-slate-600 mb-4">Optional. You can add this later from your profile.</p>
                <Button variant="secondary" size="sm" type="button">Upload Transcript (PDF)</Button>
              </div>
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
            <div>
              {currentStep > 0 && (
                <Button variant="ghost" onClick={handleBack} type="button" id="signup-back-btn">
                  <ChevronLeft size={16} /> Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep < STEPS.length - 1 && currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={handleNext} type="button" id="signup-skip-btn">
                  Skip
                </Button>
              )}
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={handleNext} type="button" id="signup-next-btn">
                  Continue <ChevronRight size={16} />
                </Button>
              ) : (
                <Button onClick={handleSubmit} loading={isSubmitting} type="button" id="signup-submit-btn">
                  Create Account
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
