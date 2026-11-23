import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, GraduationCap, FlaskConical, Code, Languages, FileText, ChevronRight, ChevronLeft } from 'lucide-react'
import { serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import {
  buildDirectoryEntryFromStudent,
  saveSplitStudentProfile,
  syncUserDirectoryEntry,
} from '@/lib/messaging'
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
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  country: z.string().min(1, 'Please select your country'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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
  const { signUp, user: currentUser, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Account form (validated step 0)
  const accountForm = useForm<AccountForm>({ resolver: zodResolver(accountSchema) })

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
  const [cvUrl, setCvUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')

  const handleNext = async () => {
    if (currentStep === 0) {
      const valid = await accountForm.trigger()
      if (!valid) return
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
      const languageScores: Array<{
        id: string
        type: 'IELTS' | 'TOEFL' | 'TOPIK' | 'Other'
        score: string
        label?: string
      }> = []
      if (language.ielts) languageScores.push({ id: 'ielts', type: 'IELTS' as const, score: language.ielts })
      if (language.toefl) languageScores.push({ id: 'toefl', type: 'TOEFL' as const, score: language.toefl })
      if (language.topik) languageScores.push({ id: 'topik', type: 'TOPIK' as const, score: language.topik })
      if (language.other && language.otherLabel) languageScores.push({ id: 'other', type: 'Other' as const, score: language.other, label: language.otherLabel })

      const parsedGpa = parseFloat(academic.gpa)
      const parsedGpaScale = parseFloat(academic.gpaScale)

      await signUp(accountData.email, accountData.password, accountData.fullName, 'student', async (user) => {
        const baseProfile = {
          uid: user.uid,
          fullName: accountData.fullName.trim(),
          username: accountData.username.trim(),
          email: accountData.email.trim(),
          country: accountData.country,
          university: academic.university.trim(),
          department: academic.department.trim(),
          major: academic.major.trim(),
          degree: (academic.degree || 'Master') as 'Bachelor' | 'Master' | 'PhD',
          currentSemester: academic.currentSemester.trim(),
          expectedGraduation: academic.expectedGraduation,
          gpa: Number.isFinite(parsedGpa) ? parsedGpa : 0,
          gpaScale: Number.isFinite(parsedGpaScale) ? parsedGpaScale : 4.0,
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
          cvUrl: cvUrl.trim(),
          portfolioUrl: portfolioUrl.trim(),
          savedProfessorIds: [],
        }

        const newStudentProfile = {
          ...baseProfile,
          profileCompleteness: calculateProfileCompleteness({
            ...baseProfile,
            languageScores,
            cvUrl: cvUrl.trim(),
          }),
        }

        await saveSplitStudentProfile(user.uid, {
          ...newStudentProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        await syncUserDirectoryEntry(buildDirectoryEntryFromStudent(newStudentProfile))
      })

      navigate('/dashboard/student', { replace: true })
    } catch (err: unknown) {
      const code = ((err as { code?: string })?.code || '').toLowerCase()
      const msg = ((err as { message?: string })?.message || '').toLowerCase()
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in.')
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 8 characters.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else if (code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.')
      } else if (
        code === 'auth/network-request-failed' ||
        code.includes('unavailable') ||
        code.includes('deadline-exceeded') ||
        msg.includes('offline') ||
        msg.includes('network')
      ) {
        setError('Network error while saving your profile. Please check your connection and click Create Account again to retry.')
      } else {
        setError('Sign up failed while saving your profile. Please try again.')
        console.error(err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authLoading && !isSubmitting && currentUser && (role === 'student' || role === 'professor')) {
    return <Navigate to={role === 'professor' ? '/dashboard/professor' : '/dashboard/student'} replace />
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
              <Input label="Full Name" placeholder="Dr. Jane Smith" required {...accountForm.register('fullName')} error={accountForm.formState.errors.fullName?.message} id="signup-fullname" />
              <Input label="Username" placeholder="janesmith" required {...accountForm.register('username')} error={accountForm.formState.errors.username?.message} id="signup-username" hint="Letters, numbers, underscore only. Cannot be changed later." />
              <Input label="Email Address" type="email" placeholder="jane@university.edu" required {...accountForm.register('email')} error={accountForm.formState.errors.email?.message} id="signup-email" />
              <Select label="Country" options={COUNTRY_OPTIONS} placeholder="Select your country" required {...accountForm.register('country')} error={accountForm.formState.errors.country?.message} id="signup-country" />
              <Input label="Password" type="password" placeholder="At least 8 characters" required {...accountForm.register('password')} error={accountForm.formState.errors.password?.message} id="signup-password" />
              <Input label="Confirm Password" type="password" placeholder="Repeat your password" required {...accountForm.register('confirmPassword')} error={accountForm.formState.errors.confirmPassword?.message} id="signup-confirm-password" />
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
                <h2 className="font-semibold text-white text-lg">CV & Portfolio</h2>
                <span className="text-xs text-slate-500">Optional — can also upload or update later</span>
              </div>
              <Input
                label="Curriculum Vitae (CV) Link"
                type="url"
                placeholder="https://example.com/your-cv.pdf"
                value={cvUrl}
                onChange={(e) => setCvUrl(e.target.value)}
                id="signup-cv-url"
                hint="You can also upload a PDF/DOCX CV file directly from your Student Profile or when applying."
              />
              <Input
                label="Personal Website / GitHub Portfolio"
                type="url"
                placeholder="https://github.com/username"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                id="signup-portfolio-url"
              />
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
