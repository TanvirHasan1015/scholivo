import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ArrowLeft, Send, Sparkles, FileText, CheckCircle2,
  Building, AlertCircle, ShieldAlert, GraduationCap
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Position } from '@/types/position.types'
import type { StudentProfile, AffiliationVerificationStatus } from '@/types/user.types'
import type { Application } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { computeMatch } from '@/lib/matching'
import { MatchScoreBadge, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { FUNDING_LABELS } from '@/utils/helpers'

function createEmptyStudentProfile(uid = '', email = '', displayName = '', photoURL?: string): StudentProfile {
  const now = new Date().toISOString()
  return {
    uid,
    fullName: displayName,
    username: email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '',
    email,
    country: '',
    photoURL,
    university: '',
    department: '',
    major: '',
    degree: 'Master',
    currentSemester: '',
    expectedGraduation: '',
    gpa: 0,
    gpaScale: 4.0,
    researchInterests: [],
    researchAreas: [],
    researchExperience: [],
    projects: [],
    publications: [],
    programmingLanguages: [],
    frameworks: [],
    technicalSkills: [],
    researchTools: [],
    languageScores: [],
    verificationStatus: 'pending',
    accountStatus: 'active',
    profileCompleteness: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export default function Apply() {
  const { positionId } = useParams<{ positionId: string }>()
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [position, setPosition] = useState<Position | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() =>
    createEmptyStudentProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [verificationStatus, setVerificationStatus] = useState<AffiliationVerificationStatus>('pending')
  const [existingApplication, setExistingApplication] = useState<Application | null>(null)

  const [statement, setStatement] = useState('')
  const [cvUrl, setCvUrl] = useState('')
  const [transcriptUrl, setTranscriptUrl] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (authLoading) return
    let isMounted = true

    async function loadApplyData() {
      if (!positionId || !user) {
        if (isMounted) setInitialLoading(false)
        return
      }

      if (isMounted) {
        setInitialLoading(true)
        setErrorMsg(null)
      }

      try {
        const deterministicAppId = `app-${user.uid}-${positionId}`
        const [posSnap, studentSnap, deterministicAppSnap, existingAppSnap] = await Promise.all([
          getDoc(doc(db, 'positions', positionId)),
          getDoc(doc(db, 'students', user.uid)),
          getDoc(doc(db, 'applications', deterministicAppId)),
          getDocs(
            query(
              collection(db, 'applications'),
              where('studentId', '==', user.uid),
              where('positionId', '==', positionId)
            )
          ),
        ])

        if (!isMounted) return

        if (posSnap.exists()) {
          const p = posSnap.data() as Position
          setPosition({
            ...p,
            id: posSnap.id,
            researchTopics: Array.isArray(p.researchTopics) ? p.researchTopics : [],
            requiredSkills: Array.isArray(p.requiredSkills) ? p.requiredSkills : [],
            preferredSkills: Array.isArray(p.preferredSkills) ? p.preferredSkills : [],
          })
        } else {
          setPosition(null)
        }

        if (studentSnap.exists()) {
          const sData = studentSnap.data() as Partial<StudentProfile>
          const base = createEmptyStudentProfile(
            user.uid,
            user.email || '',
            user.displayName || '',
            user.photoURL || undefined
          )
          const normalized: StudentProfile = {
            ...base,
            ...sData,
            uid: sData.uid || user.uid,
            researchInterests: Array.isArray(sData.researchInterests) ? sData.researchInterests : [],
            researchAreas: Array.isArray(sData.researchAreas) ? sData.researchAreas : [],
            researchExperience: Array.isArray(sData.researchExperience) ? sData.researchExperience : [],
            projects: Array.isArray(sData.projects) ? sData.projects : [],
            publications: Array.isArray(sData.publications) ? sData.publications : [],
            programmingLanguages: Array.isArray(sData.programmingLanguages) ? sData.programmingLanguages : [],
            frameworks: Array.isArray(sData.frameworks) ? sData.frameworks : [],
            technicalSkills: Array.isArray(sData.technicalSkills) ? sData.technicalSkills : [],
            researchTools: Array.isArray(sData.researchTools) ? sData.researchTools : [],
            languageScores: Array.isArray(sData.languageScores) ? sData.languageScores : [],
          }
          setStudentProfile(normalized)
          setVerificationStatus(normalized.verificationStatus || 'pending')
          setCvUrl(normalized.cvUrl || '')
          setTranscriptUrl(normalized.transcriptUrl || '')
        } else {
          setVerificationStatus('pending')
        }

        if (deterministicAppSnap.exists()) {
          setExistingApplication({
            ...(deterministicAppSnap.data() as Application),
            id: deterministicAppSnap.id,
          })
        } else if (!existingAppSnap.empty) {
          const firstDoc = existingAppSnap.docs[0]
          setExistingApplication({
            ...(firstDoc.data() as Application),
            id: firstDoc.id,
          })
        } else {
          setExistingApplication(null)
        }

        setErrorMsg(null)
      } catch (err) {
        console.error('Failed to load application data from Firestore:', err)
        if (isMounted) {
          setErrorMsg('Failed to load opportunity details. Please check your connection and try again.')
        }
      } finally {
        if (isMounted) setInitialLoading(false)
      }
    }

    loadApplyData()
    return () => {
      isMounted = false
    }
  }, [positionId, user, authLoading])

  // Compute live match score using the existing matching algorithm
  const matchResult = useMemo(() => {
    if (!position) return null
    return computeMatch(studentProfile, position)
  }, [studentProfile, position])

  const isVerified = verificationStatus === 'verified'
  const isAccountActive = (studentProfile.accountStatus || 'active') === 'active'
  const isPositionOpen = Boolean(position?.isOpen)
  const canSubmit =
    Boolean(user) &&
    role === 'student' &&
    isAccountActive &&
    Boolean(position) &&
    isPositionOpen &&
    isVerified &&
    !existingApplication &&
    Boolean(statement.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return
    if (!user || role !== 'student' || !position || !matchResult || !canSubmit) return

    isSubmittingRef.current = true
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Check query for any existing application for this (studentId, positionId) pair
      const dupSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('studentId', '==', user.uid),
          where('positionId', '==', position.id)
        )
      )
      if (!dupSnap.empty) {
        const dupDoc = dupSnap.docs[0]
        setExistingApplication({
          ...(dupDoc.data() as Application),
          id: dupDoc.id,
        })
        setErrorMsg('You have already submitted an application for this position.')
        return
      }

      const now = new Date().toISOString()
      const applicationId = `app-${user.uid}-${position.id}`
      const resolvedPhotoURL = studentProfile.photoURL || user.photoURL || ''
      const resolvedTranscriptUrl = transcriptUrl.trim()

      const newApp: Application = {
        id: applicationId,
        studentId: user.uid,
        studentName: studentProfile.fullName || user.displayName || 'Student Applicant',
        ...(resolvedPhotoURL ? { studentPhotoURL: resolvedPhotoURL } : {}),
        professorId: position.professorId,
        positionId: position.id,
        positionTitle: position.title,
        professorName: position.professorName,
        university: position.university,
        matchScore: matchResult.score,
        matchBreakdown: matchResult.breakdown,
        matchExplanation: matchResult.explanation,
        cvUrl: cvUrl.trim(),
        ...(resolvedTranscriptUrl ? { transcriptUrl: resolvedTranscriptUrl } : {}),
        applicationStatement: statement.trim(),
        status: 'submitted',
        statusHistory: [
          {
            status: 'submitted',
            changedAt: now,
            note: 'Application submitted online by verified student',
          },
        ],
        submittedAt: now,
        updatedAt: now,
      }

      // 2. Atomic Firestore transaction on deterministic application ID and position document
      // Prevents simultaneous duplicate submissions and guarantees existing documents are never overwritten.
      const appRef = doc(db, 'applications', applicationId)
      const posRef = doc(db, 'positions', position.id)

      let existingFromTx: Application | null = null

      await runTransaction(db, async (transaction) => {
        const [existingDocSnap, latestPosSnap] = await Promise.all([
          transaction.get(appRef),
          transaction.get(posRef),
        ])

        if (existingDocSnap.exists()) {
          existingFromTx = {
            ...(existingDocSnap.data() as Application),
            id: existingDocSnap.id,
          }
          return
        }

        if (!latestPosSnap.exists() || !latestPosSnap.data()?.isOpen) {
          throw new Error('POSITION_CLOSED')
        }

        transaction.set(appRef, {
          ...newApp,
          createdAt: serverTimestamp(),
        })
      })

      if (existingFromTx) {
        setExistingApplication(existingFromTx)
        setErrorMsg('You have already submitted an application for this position.')
        return
      }

      setSubmitted(true)
    } catch (err) {
      if (err instanceof Error && err.message === 'POSITION_CLOSED') {
        setPosition((prev) => (prev ? { ...prev, isOpen: false } : prev))
        setErrorMsg('This research opportunity has been closed and is no longer accepting applications.')
      } else {
        console.error('Failed to submit application to Firestore:', err)
        setErrorMsg('Failed to submit your application. Please check your connection and try again.')
      }
    } finally {
      isSubmittingRef.current = false
      setLoading(false)
    }
  }

  if (authLoading || initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading research opportunity details…</p>
        </div>
      </div>
    )
  }

  if (!position || !matchResult) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center shadow-2xs max-w-md space-y-4">
          <GraduationCap size={40} className="mx-auto text-slate-400" />
          <h1 className="text-xl font-bold font-display text-slate-900">Position Not Found</h1>
          <p className="text-sm text-slate-500">
            The research opportunity you are trying to apply for does not exist or is no longer available.
          </p>
          <Button onClick={() => navigate('/search')}>Browse Faculty Directory</Button>
        </div>
      </div>
    )
  }

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

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Duplicate Application Alert if student already applied */}
        {existingApplication && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-xs flex items-start gap-4" id="duplicate-application-alert">
            <CheckCircle2 size={22} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold text-blue-900">
                Application Already Submitted
              </h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                You have already submitted an application for <strong>{position.title}</strong>. Duplicate applications for the same position are not permitted.
              </p>
              <div className="pt-1 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => navigate(`/applications/${existingApplication.id}`)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  View Submitted Application
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/applications')}
                  className="text-xs"
                >
                  All My Applications
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Position Closed Alert if !isPositionOpen */}
        {!isPositionOpen && (
          <div className="bg-slate-100 border border-slate-300 rounded-2xl p-5 shadow-xs flex items-start gap-4">
            <AlertCircle size={22} className="text-slate-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Recruitment Closed
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This research opportunity is not currently accepting new student applications.
              </p>
            </div>
          </div>
        )}

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
                  disabled={!isVerified || Boolean(existingApplication) || !isPositionOpen}
                  placeholder={
                    existingApplication
                      ? 'You have already submitted an application for this position.'
                      : !isPositionOpen
                      ? 'Recruitment is closed for this position.'
                      : isVerified
                      ? 'Describe your academic background, thesis work, and why you wish to join this group...'
                      : 'Affiliation verification required before submitting applications.'
                  }
                  rows={6}
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Verified Documents & Links */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Application Documents
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Curriculum Vitae (CV) URL
                    </label>
                    <input
                      type="url"
                      value={cvUrl}
                      onChange={(e) => setCvUrl(e.target.value)}
                      disabled={!isVerified || Boolean(existingApplication) || !isPositionOpen}
                      placeholder="https://example.com/your-cv.pdf"
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                      id="apply-cv-url"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Transcript URL (GPA: {studentProfile.gpa} / {studentProfile.gpaScale || 4.0})
                    </label>
                    <input
                      type="url"
                      value={transcriptUrl}
                      onChange={(e) => setTranscriptUrl(e.target.value)}
                      disabled={!isVerified || Boolean(existingApplication) || !isPositionOpen}
                      placeholder="https://example.com/your-transcript.pdf"
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                      id="apply-transcript-url"
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {existingApplication
                    ? 'Application already submitted'
                    : !isPositionOpen
                    ? 'Recruitment closed'
                    : isVerified
                    ? 'Ready for faculty review upon submission'
                    : 'Verification required to submit'}
                </span>

                <Button
                  type="submit"
                  size="md"
                  disabled={!canSubmit || loading}
                  loading={loading}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  id="submit-application-btn"
                >
                  <Send size={14} className="mr-1.5" />
                  {existingApplication ? 'Already Applied' : 'Submit Formal Application'}
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
