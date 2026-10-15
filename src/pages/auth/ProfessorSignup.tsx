import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BookOpen, User, GraduationCap, FlaskConical, Shield, ChevronRight, ChevronLeft, Upload, CheckCircle } from 'lucide-react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { Input, Select, Textarea } from '@/components/common/Input'
import { TagInput } from '@/components/common/TagInput'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'
import { RESEARCH_AREAS, COUNTRIES } from '@/utils/helpers'

const accountSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  username: z.string().min(3, 'At least 3 characters').regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscore only'),
  email: z.string().email('Enter a valid institutional email'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
  academicTitle: z.string().min(1, 'Select your title'),
  country: z.string().min(1, 'Select your country'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type AccountForm = z.infer<typeof accountSchema>

const STEPS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'profile', label: 'Profile', icon: GraduationCap },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'verification', label: 'Verify', icon: Shield },
]

const TITLES = [
  { value: 'Assistant Professor', label: 'Assistant Professor' },
  { value: 'Associate Professor', label: 'Associate Professor' },
  { value: 'Full Professor', label: 'Full Professor' },
  { value: 'Research Professor', label: 'Research Professor' },
  { value: 'Adjunct Professor', label: 'Adjunct Professor' },
  { value: 'Lecturer', label: 'Lecturer' },
  { value: 'Senior Researcher', label: 'Senior Researcher' },
  { value: 'Research Scientist', label: 'Research Scientist' },
]

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: c }))

export default function ProfessorSignup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const accountForm = useForm<AccountForm>({ resolver: zodResolver(accountSchema) })

  const [profile, setProfile] = useState({
    university: '', department: '', faculty: '',
    universityProfileUrl: '', googleScholarUrl: '', orcid: '', personalWebpageUrl: '',
    biography: '',
  })

  const [research, setResearch] = useState({
    researchAreas: [] as string[],
    researchInterests: [] as string[],
  })

  const [verificationDoc, setVerificationDoc] = useState<File | null>(null)

  const handleNext = async () => {
    if (currentStep === 0) {
      const valid = await accountForm.trigger()
      if (!valid) return
    }
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1) }

  const handleSubmit = async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const accountData = accountForm.getValues()
      const user = await signUp(accountData.email, accountData.password, accountData.fullName, 'professor')

      const newProfProfile = {
        uid: user.uid,
        fullName: accountData.fullName,
        username: accountData.username,
        email: accountData.email,
        academicTitle: accountData.academicTitle || 'Assistant Professor',
        country: accountData.country || 'United States',
        university: profile.university || 'Stanford University',
        department: profile.department || 'Computer Science',
        faculty: profile.faculty || 'School of Engineering',
        universityProfileUrl: profile.universityProfileUrl || 'https://stanford.edu/faculty',
        googleScholarUrl: profile.googleScholarUrl || 'https://scholar.google.com',
        orcid: profile.orcid || '0000-0002-1825-0097',
        personalWebpageUrl: profile.personalWebpageUrl || '',
        biography: profile.biography || 'Researching advanced computing and intelligence systems.',
        researchAreas: research.researchAreas || ['Artificial Intelligence'],
        researchInterests: research.researchInterests || ['Machine Learning'],
        currentProjects: [],
        publications: [],
        verificationStatus: 'pending' as const,
        verificationDocuments: [],
        accountStatus: 'active' as const,
        isRecruiting: false,
        recruitingStatus: 'not_recruiting' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // 1. Save profile to localStorage
      localStorage.setItem('rm_demo_professor_profile', JSON.stringify(newProfProfile))

      // 2. Queue verification request in rm_demo_verifications
      const newVerificationReq = {
        id: `req-${Date.now()}`,
        userId: user.uid,
        userName: accountData.fullName,
        userEmail: accountData.email,
        userRole: 'professor' as const,
        university: profile.university || 'Stanford University',
        department: profile.department || 'Computer Science',
        academicTitleOrDegree: accountData.academicTitle || 'Assistant Professor',
        docType: verificationDoc ? 'Institutional Faculty Proof Document' : 'Official Academic Webpage Directory',
        docUrl: profile.universityProfileUrl || 'https://example.com/faculty_id.pdf',
        officialProfileUrl: profile.universityProfileUrl || 'https://stanford.edu/faculty',
        status: 'pending' as const,
        accountStatus: 'active' as const,
        submittedAt: new Date().toISOString(),
      }

      const existingVerifications = localStorage.getItem('rm_demo_verifications')
      const verificationsList = existingVerifications ? JSON.parse(existingVerifications) : []
      localStorage.setItem('rm_demo_verifications', JSON.stringify([newVerificationReq, ...verificationsList]))

      // 3. Add to rm_demo_system_users
      const newSystemUser = {
        uid: user.uid,
        displayName: accountData.fullName,
        email: accountData.email,
        role: 'professor' as const,
        university: profile.university || 'Stanford University',
        department: profile.department || 'Computer Science',
        academicTitleOrDegree: accountData.academicTitle || 'Assistant Professor',
        verificationStatus: 'pending' as const,
        accountStatus: 'active' as const,
        createdAt: new Date().toISOString().slice(0, 10),
        openPositionsCount: 0,
        applicationsCount: 0,
      }
      const existingUsers = localStorage.getItem('rm_demo_system_users')
      const usersList = existingUsers ? JSON.parse(existingUsers) : []
      localStorage.setItem('rm_demo_system_users', JSON.stringify([newSystemUser, ...usersList]))

      try {
        await setDoc(doc(db, 'professors', user.uid), {
          ...newProfProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } catch {
        // demo mode Firestore fallback
      }

      navigate('/dashboard/professor')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in.')
      } else {
        setError('Sign up failed. Please try again.')
        console.error(err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-hero-gradient py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-6">
            <BrandLogo variant="dark" iconSize="lg" textSize="xl" showTagline />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-1">Join as a Professor</h1>
          <p className="text-slate-400 text-sm">Create your academic profile and recruit talented researchers on Scholivo</p>
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
                  <span className={`text-xs hidden sm:block ${isActive ? 'text-indigo-300' : isDone ? 'text-slate-400' : 'text-slate-700'}`}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-all ${isDone ? 'bg-indigo-600' : 'bg-white/8'}`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="glass-strong rounded-3xl border border-white/10 p-7 shadow-2xl">
          {/* Step 0: Account */}
          {currentStep === 0 && (
            <div className="space-y-4 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-5">Account Information</h2>
              <Input label="Full Name" placeholder="Prof. John Kim" required {...accountForm.register('fullName')} error={accountForm.formState.errors.fullName?.message} id="prof-fullname" />
              <Input label="Username" placeholder="profkim" required {...accountForm.register('username')} error={accountForm.formState.errors.username?.message} id="prof-username" hint="Lowercase letters, numbers, underscore" />
              <Input label="Official University Email" type="email" placeholder="you@university.edu" required {...accountForm.register('email')} error={accountForm.formState.errors.email?.message} id="prof-email" hint="Must be your institutional email for verification" />
              <Select label="Academic Title" options={TITLES} placeholder="Select your title" required {...accountForm.register('academicTitle')} error={accountForm.formState.errors.academicTitle?.message} id="prof-title" />
              <Select label="Country" options={COUNTRY_OPTIONS} placeholder="Select your country" required {...accountForm.register('country')} error={accountForm.formState.errors.country?.message} id="prof-country" />
              <Input label="Password" type="password" placeholder="At least 8 characters" required {...accountForm.register('password')} error={accountForm.formState.errors.password?.message} id="prof-password" />
              <Input label="Confirm Password" type="password" placeholder="Repeat your password" required {...accountForm.register('confirmPassword')} error={accountForm.formState.errors.confirmPassword?.message} id="prof-confirm-password" />
            </div>
          )}

          {/* Step 1: Profile */}
          {currentStep === 1 && (
            <div className="space-y-4 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-5">Academic Profile</h2>
              <Input label="University" placeholder="e.g., KAIST, MIT, Oxford" value={profile.university} onChange={(e) => setProfile({ ...profile, university: e.target.value })} id="prof-university" required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Department" placeholder="e.g., Computer Science" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} id="prof-department" />
                <Input label="Faculty / School" placeholder="e.g., School of Engineering" value={profile.faculty} onChange={(e) => setProfile({ ...profile, faculty: e.target.value })} id="prof-faculty" />
              </div>
              <Textarea label="Biography" placeholder="Describe your academic background, research vision, and lab culture…" rows={4} value={profile.biography} onChange={(e) => setProfile({ ...profile, biography: e.target.value })} id="prof-bio" showCount maxLength={1000} />
              <div className="border-t border-white/8 pt-4">
                <p className="text-sm font-medium text-slate-400 mb-3">Web Presence (optional)</p>
                <div className="space-y-3">
                  <Input label="University Profile URL" type="url" placeholder="https://cs.university.edu/~yourname" value={profile.universityProfileUrl} onChange={(e) => setProfile({ ...profile, universityProfileUrl: e.target.value })} id="prof-uni-url" />
                  <Input label="Google Scholar URL" type="url" placeholder="https://scholar.google.com/citations?user=…" value={profile.googleScholarUrl} onChange={(e) => setProfile({ ...profile, googleScholarUrl: e.target.value })} id="prof-scholar-url" />
                  <Input label="ORCID" placeholder="0000-0000-0000-0000" value={profile.orcid} onChange={(e) => setProfile({ ...profile, orcid: e.target.value })} id="prof-orcid" />
                  <Input label="Personal / Research Webpage" type="url" placeholder="https://yourlab.com" value={profile.personalWebpageUrl} onChange={(e) => setProfile({ ...profile, personalWebpageUrl: e.target.value })} id="prof-webpage" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Research */}
          {currentStep === 2 && (
            <div className="space-y-5 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-5">Research Information</h2>
              <TagInput
                label="Research Areas"
                tags={research.researchAreas}
                onChange={(tags) => setResearch({ ...research, researchAreas: tags })}
                suggestions={RESEARCH_AREAS}
                placeholder="e.g., Computer Vision, NLP…"
                hint="Broad fields you work in. Used for student matching."
              />
              <TagInput
                label="Specific Research Interests"
                tags={research.researchInterests}
                onChange={(tags) => setResearch({ ...research, researchInterests: tags })}
                suggestions={['Image Segmentation', 'Object Detection', 'Transformers', 'Diffusion Models', 'GNN', 'Federated Learning', 'Explainable AI', 'Multi-agent Systems', 'SLAM', 'Medical Imaging']}
                placeholder="e.g., Image Segmentation, Transformers…"
                hint="Specific topics within your research. More detail = better matches."
              />
            </div>
          )}

          {/* Step 3: Verification */}
          {currentStep === 3 && (
            <div className="space-y-5 fade-in-up">
              <h2 className="font-semibold text-white text-lg mb-2">Account Verification</h2>
              <p className="text-sm text-slate-400 mb-5">
                Professor accounts require verification to ensure the integrity of the platform.
                Your account will be reviewed by our admin team within 2–3 business days.
              </p>

              {/* Verification steps */}
              <div className="space-y-3">
                {[
                  { n: 1, label: 'Email Verification', desc: 'A verification link will be sent to your university email after signup.', done: true },
                  { n: 2, label: 'Upload Institutional Proof', desc: 'Upload your faculty ID, appointment letter, or institutional proof.', done: false },
                  { n: 3, label: 'Admin Review', desc: 'Our team reviews your documents and approves your account.', done: false },
                ].map(({ n, label, desc, done }) => (
                  <div key={n} className="flex gap-3 p-4 glass rounded-xl border border-white/8">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${done ? 'bg-indigo-600' : 'bg-white/8 border border-white/15'}`}>
                      {done ? <CheckCircle size={14} className="text-white" /> : <span className="text-xs text-slate-500">{n}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Document upload */}
              <div
                className="glass rounded-2xl border-2 border-dashed border-white/15 p-8 text-center hover:border-indigo-500/40 transition-colors cursor-pointer"
                onClick={() => document.getElementById('verification-doc-input')?.click()}
                id="verification-upload-area"
              >
                <input
                  id="verification-doc-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setVerificationDoc(e.target.files?.[0] || null)}
                />
                {verificationDoc ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle size={28} className="text-emerald-400" />
                    <p className="text-sm text-emerald-400 font-medium">{verificationDoc.name}</p>
                    <p className="text-xs text-slate-500">Click to change file</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={28} className="text-slate-600" />
                    <p className="text-sm text-slate-400">Upload Faculty ID or Institutional Proof</p>
                    <p className="text-xs text-slate-600">PDF, JPG or PNG — max 10MB</p>
                    <Button variant="secondary" size="sm" type="button" className="mt-2">Select File</Button>
                  </div>
                )}
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
                <Button variant="ghost" onClick={handleBack} type="button" id="prof-signup-back">
                  <ChevronLeft size={16} /> Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={handleNext} type="button" id="prof-signup-next">
                  Continue <ChevronRight size={16} />
                </Button>
              ) : (
                <Button onClick={handleSubmit} loading={isSubmitting} type="button" id="prof-signup-submit">
                  Create Professor Account
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
