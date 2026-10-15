import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import {
  ArrowLeft, Send, Sparkles, FileText, CheckCircle2,
  Calendar, DollarSign, Building, AlertCircle, ShieldAlert,
  GraduationCap, ExternalLink, Lock
} from 'lucide-react'
import { db, isDemoMode } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Position } from '@/types/position.types'
import type { StudentProfile, AffiliationVerificationStatus } from '@/types/user.types'
import type { Application } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { computeMatch } from '@/lib/matching'
import { MatchScoreBadge, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { FUNDING_LABELS } from '@/utils/helpers'
import { DEMO_PROFESSORS, DEMO_STUDENT_PROFILE, DEMO_PROFESSOR_APPLICATIONS } from '@/lib/demoData'

// Fallback position for demo
const FALLBACK_POSITION: Position = {
  id: 'p1',
  professorId: 'demo-1',
  professorName: 'Prof. Minji Kim',
  professorTitle: 'Associate Professor',
  university: 'KAIST',
  department: 'School of Computing',
  country: 'South Korea',
  title: 'PhD Position — Computer Vision & Medical AI',
  degreeType: 'PhD',
  description: 'Looking for motivated PhD students to work on 3D medical image segmentation and diffusion models for pathology synthesis.',
  researchArea: 'Computer Vision',
  researchTopics: ['Computer Vision', 'Deep Learning', 'Medical AI', 'Diffusion Models'],
  requiredSkills: ['Python', 'PyTorch', 'Computer Vision'],
  preferredSkills: ['Medical Imaging', 'CUDA', '3D Vision'],
  minimumGPA: 3.5,
  gpaScale: 4.0,
  languageRequirements: [{ type: 'IELTS', minimumScore: '7.0' }],
  otherRequirements: 'Strong mathematical background and publication in CVPR/ICCV/MICCAI preferred.',
  fundingType: 'fully_funded',
  fundingDetails: 'Full tuition coverage + monthly living stipend of 2,200,000 KRW',
  stipend: '2,200,000 KRW/mo',
  applicationDeadline: '2026-11-30',
  startDate: 'Spring 2027',
  isOpen: true,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
}

export default function Apply() {
  const { positionId } = useParams<{ positionId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [position, setPosition] = useState<Position>(FALLBACK_POSITION)
  const [statement, setStatement] = useState('')
  const [cvUrl, setCvUrl] = useState('https://example.com/alex_rivera_cv.pdf')
  const [transcriptUrl, setTranscriptUrl] = useState('https://example.com/alex_rivera_transcript.pdf')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Current student profile for matching
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() => {
    const saved = localStorage.getItem('rm_demo_student_profile')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return DEMO_STUDENT_PROFILE
  })

  // Affiliation verification status check
  const [verificationStatus, setVerificationStatus] = useState<AffiliationVerificationStatus>(() => {
    // 1. Check rm_demo_verifications
    const savedVerifications = localStorage.getItem('rm_demo_verifications')
    if (savedVerifications) {
      try {
        const list = JSON.parse(savedVerifications)
        const myRecord = list.find((item: any) =>
          (user && (item.userId === user.uid || (item.applicantEmail && user.email && item.applicantEmail.toLowerCase() === user.email.toLowerCase()))) ||
          (!user && item.userId === 'demo-student')
        )
        if (myRecord) return myRecord.status
      } catch {
        // fallback
      }
    }

    // 2. Check student profile
    const savedStudent = localStorage.getItem('rm_demo_student_profile')
    if (savedStudent) {
      try {
        const parsed = JSON.parse(savedStudent)
        if (parsed.verificationStatus) return parsed.verificationStatus
      } catch {
        // fallback
      }
    }

    return 'verified'
  })

  // Compute live match score
  const matchResult = computeMatch(studentProfile, position)

  useEffect(() => {
    if (!positionId) return

    // 1. Check in DEMO_PROFESSORS positions
    for (const prof of DEMO_PROFESSORS) {
      const found = prof.positions.find((p) => p.id === positionId)
      if (found) {
        setPosition(found)
        return
      }
    }

    // 2. Check in localStorage rm_demo_positions
    const savedPos = localStorage.getItem('rm_demo_positions')
    if (savedPos) {
      try {
        const parsed: Position[] = JSON.parse(savedPos)
        const found = parsed.find((p) => p.id === positionId)
        if (found) {
          setPosition(found)
          return
        }
      } catch {
        // pass
      }
    }

    // 3. Fallback Firestore fetch
    async function fetchPos() {
      try {
        const snap = await getDoc(doc(db, 'positions', positionId!))
        if (snap.exists()) {
          setPosition({ id: snap.id, ...snap.data() } as Position)
        }
      } catch (err) {
        console.warn('Using fallback position:', err)
      }
    }
    fetchPos()
  }, [positionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!statement.trim() || verificationStatus !== 'verified') return

    setLoading(true)
    const applicationId = `app-${Date.now()}`

    const newApp: Application = {
      id: applicationId,
      studentId: user?.uid || 'demo-student',
      studentName: user?.displayName || studentProfile.fullName || 'Alex Rivera',
      studentPhotoURL: user?.photoURL || studentProfile.photoURL,
      professorId: position.professorId,
      positionId: position.id,
      positionTitle: position.title,
      professorName: position.professorName,
      university: position.university,
      matchScore: matchResult.score,
      matchBreakdown: matchResult.breakdown,
      matchExplanation: matchResult.explanation,
      cvUrl: cvUrl || 'https://example.com/alex_rivera_cv.pdf',
      transcriptUrl: transcriptUrl || 'https://example.com/alex_rivera_transcript.pdf',
      applicationStatement: statement,
      status: 'submitted',
      statusHistory: [
        {
          status: 'submitted',
          changedAt: new Date().toISOString(),
          note: 'Application submitted online by verified student',
        },
      ],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to localStorage rm_demo_applications for immediate synchronization with professor
    const savedAppsStr = localStorage.getItem('rm_demo_applications')
    let allApps: Application[] = savedAppsStr ? JSON.parse(savedAppsStr) : [...DEMO_PROFESSOR_APPLICATIONS]
    allApps = [newApp, ...allApps]
    localStorage.setItem('rm_demo_applications', JSON.stringify(allApps))

    try {
      await setDoc(doc(db, 'applications', applicationId), {
        ...newApp,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('Saved in demo storage:', err)
    }

    setLoading(false)
    setSubmitted(true)
  }

  const isVerified = verificationStatus === 'verified'

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="bg-white rounded-3xl border border-emerald-200 p-8 sm:p-10 shadow-xs space-y-5 animate-scaleUp">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                Application Successfully Submitted!
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Your application has been received by{' '}
                <strong className="text-slate-900 font-semibold">{position.professorName}</strong> at {position.university}.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2.5 text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-400">Position:</span>
                <span className="font-semibold text-slate-900">{position.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-400">Match Compatibility:</span>
                <span className="font-bold text-blue-600">{matchResult.score}% Match Overlap</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-semibold text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded">
                  Submitted / Awaiting Review
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                fullWidth
                size="md"
                onClick={() => navigate('/dashboard/student')}
                className="text-xs"
              >
                Go to Student Dashboard
              </Button>
              <Button
                fullWidth
                size="md"
                onClick={() => navigate('/search')}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Browse Other Faculty
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-20 pb-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Back Navigation */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-200/60"
        >
          <ArrowLeft size={14} />
          Back to Search / Openings
        </button>

        {/* Verification Barrier Alert if NOT verified */}
        {!isVerified && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs flex items-start gap-4">
            <ShieldAlert size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900">
                Institutional Affiliation Verification Required
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Your student affiliation status is currently <strong className="uppercase font-bold underline">{verificationStatus}</strong>.
                Unverified or pending students may browse and bookmark faculty opportunities, but your university enrollment proof must be verified by an administrator before you can submit applications to faculty.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/profile/student')}
                  className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  View Profile & Verification Info
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Position Header Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full inline-block mb-2">
                {position.degreeType} Research Opening
              </span>
              <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                {position.title}
              </h1>
              <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                <Building size={14} className="text-blue-600" />
                <span className="font-semibold text-slate-900">{position.professorName}</span>
                <span>•</span>
                <span>{position.university} ({position.department})</span>
              </p>
            </div>

            <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
              <MatchScoreBadge score={matchResult.score} size="md" />
              <span className="text-[11px] text-slate-500">Compatibility Score</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-0.5">Funding Type</span>
              <span className="font-semibold text-slate-800 capitalize">
                {FUNDING_LABELS[position.fundingType] || position.fundingType}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-0.5">Monthly Stipend</span>
              <span className="font-semibold text-slate-800">{position.stipend || 'Provided'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-0.5">Deadline</span>
              <span className="font-semibold text-slate-800">{position.applicationDeadline || 'Rolling'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block mb-0.5">Intended Start</span>
              <span className="font-semibold text-slate-800">{position.startDate || 'Upcoming Semester'}</span>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Statement & Document Confirmation */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Research Statement & Motivation
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Introduce your research background, specific interests in this lab, and how your skills align with the project.
                </p>
              </div>

              <div className="space-y-1.5">
                <textarea
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  disabled={!isVerified}
                  placeholder={
                    isVerified
                      ? 'Describe your academic background, thesis work, and why you wish to join this group...'
                      : 'Affiliation verification required before submitting applications.'
                  }
                  rows={6}
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Verified Documents Attached */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Attached Verified Documents
                </h3>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      PDF
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Academic Curriculum Vitae (CV)</p>
                      <p className="text-[11px] text-slate-500">{studentProfile.fullName}_CV.pdf</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Attached
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      PDF
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Official University Transcript</p>
                      <p className="text-[11px] text-slate-500">GPA: {studentProfile.gpa} / {studentProfile.gpaScale || 4.0}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Attached
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {isVerified ? 'Ready for faculty review upon submission' : 'Verification required to submit'}
                </span>

                <Button
                  type="submit"
                  size="md"
                  disabled={!isVerified || loading || !statement.trim()}
                  loading={loading}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  id="submit-application-btn"
                >
                  <Send size={14} className="mr-1.5" />
                  Submit Formal Application
                </Button>
              </div>
            </form>
          </div>

          {/* Right: Live Match Analysis */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles size={16} className="text-blue-600" />
                Live Match Breakdown
              </h3>

              <div className="flex flex-col items-center justify-center py-2">
                <MatchScoreBadge score={matchResult.score} size="lg" />
                <p className="text-xs text-slate-600 text-center mt-3 leading-relaxed">
                  {matchResult.explanation}
                </p>
              </div>

              <div className="pt-2">
                <MatchBreakdownPanel result={matchResult} />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
