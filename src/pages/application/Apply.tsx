import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ArrowLeft, Send, Sparkles, FileText, CheckCircle2,
  Building, AlertCircle, GraduationCap, Upload, Link as LinkIcon, ExternalLink
} from 'lucide-react'
import { db } from '@/lib/firebase'
import {
  validateCvFile,
  uploadApplicationCvFile,
  formatCvUploadError,
} from '@/lib/cvUpload'
import { loadSplitStudentProfile, saveSplitStudentProfile } from '@/lib/messaging'
import { useAuth } from '@/context/AuthContext'
import type { Position } from '@/types/position.types'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
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
  const [existingApplication, setExistingApplication] = useState<Application | null>(null)

  const [statement, setStatement] = useState('')
  const [cvMode, setCvMode] = useState<'profile' | 'upload' | 'link'>('upload')
  const [cvUrl, setCvUrl] = useState('')
  const [selectedCvFile, setSelectedCvFile] = useState<File | null>(null)
  const [uploadingCv, setUploadingCv] = useState(false)
  const [uploadedCvUrl, setUploadedCvUrl] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isSubmittingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const statementRef = useRef<HTMLTextAreaElement>(null)
  const cvUrlInputRef = useRef<HTMLInputElement>(null)

  const focusFieldIfOffscreen = (el: HTMLElement | null) => {
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const isVisible = rect.top >= 80 && rect.bottom <= window.innerHeight - 24
    if (!isVisible) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    el.focus({ preventScroll: true })
  }

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
        const [posRes, studentRes, existingAppRes] = await Promise.allSettled([
          getDoc(doc(db, 'positions', positionId)),
          loadSplitStudentProfile(user.uid),
          getDocs(
            query(
              collection(db, 'applications'),
              where('studentId', '==', user.uid),
              where('positionId', '==', positionId)
            )
          ),
        ])

        if (!isMounted) return

        if (posRes.status === 'fulfilled' && posRes.value.exists()) {
          const p = posRes.value.data() as Position
          let enrichedProfName = p.professorName
          let enrichedProfTitle = p.professorTitle
          let enrichedUniversity = p.university
          let enrichedDepartment = p.department
          let enrichedCountry = p.country

          if (p.professorId) {
            try {
              const profSnap = await getDoc(doc(db, 'professors', p.professorId))
              if (profSnap.exists()) {
                const prof = profSnap.data() as ProfessorProfile
                enrichedProfName = prof.fullName || enrichedProfName
                enrichedProfTitle = prof.academicTitle || enrichedProfTitle
                enrichedUniversity = prof.university || enrichedUniversity
                enrichedDepartment = prof.department || enrichedDepartment
                enrichedCountry = prof.country || enrichedCountry
              }
            } catch {
              // Keep position's stored metadata if professor fetch fails
            }
          }

          if (!isMounted) return

          setPosition({
            ...p,
            id: posRes.value.id,
            professorName: enrichedProfName || 'Faculty Member',
            professorTitle: enrichedProfTitle || 'Professor',
            university: enrichedUniversity || '',
            department: enrichedDepartment || '',
            country: enrichedCountry || '',
            researchTopics: Array.isArray(p.researchTopics) ? p.researchTopics : [],
            requiredSkills: Array.isArray(p.requiredSkills) ? p.requiredSkills : [],
            preferredSkills: Array.isArray(p.preferredSkills) ? p.preferredSkills : [],
          })
        } else {
          setPosition(null)
        }

        if (studentRes.status === 'fulfilled' && studentRes.value.exists) {
          const sData = studentRes.value.data
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
          const existingProfileCv = (normalized.cvUrl || '').trim()
          if (existingProfileCv) {
            setCvUrl(existingProfileCv)
            setCvMode('profile')
          } else {
            setCvMode('upload')
          }
        }

        if (existingAppRes.status === 'fulfilled' && !existingAppRes.value.empty) {
          const firstDoc = existingAppRes.value.docs[0]
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

  const MIN_STATEMENT_LENGTH = 50
  const MAX_STATEMENT_LENGTH = 2000
  const trimmedStatement = statement.trim()
  const statementLength = trimmedStatement.length
  const isStatementValid =
    statementLength >= MIN_STATEMENT_LENGTH && statementLength <= MAX_STATEMENT_LENGTH

  const isPositionOpen = Boolean(position?.isOpen)
  const canSubmit =
    Boolean(user) &&
    role === 'student' &&
    Boolean(position) &&
    isPositionOpen &&
    !existingApplication &&
    isStatementValid &&
    !uploadingCv

  const handleCvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null)
    const file = e.target.files?.[0] || null
    if (!file) {
      setSelectedCvFile(null)
      return
    }
    const validation = validateCvFile(file)
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please select a valid PDF, DOC, or DOCX file under 10 MB.')
      e.target.value = ''
      setSelectedCvFile(null)
      return
    }
    setSelectedCvFile(file)
    setUploadedCvUrl('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return
    if (!user || role !== 'student' || !position || !matchResult || existingApplication || !isPositionOpen) return

    if (statementLength < MIN_STATEMENT_LENGTH) {
      setErrorMsg(
        `Please enter at least ${MIN_STATEMENT_LENGTH} characters for your research motivation statement (currently ${statementLength} characters).`
      )
      focusFieldIfOffscreen(statementRef.current)
      return
    }
    if (statementLength > MAX_STATEMENT_LENGTH) {
      setErrorMsg(
        `Your research motivation statement must not exceed ${MAX_STATEMENT_LENGTH} characters (currently ${statementLength} characters).`
      )
      focusFieldIfOffscreen(statementRef.current)
      return
    }
    if (cvMode === 'upload' && !selectedCvFile && !uploadedCvUrl.trim()) {
      setErrorMsg(
        'Please select a CV file (PDF, DOC, or DOCX) to upload, or switch to "Saved Profile CV" / "CV Link".'
      )
      return
    }
    if (cvMode === 'link') {
      const candidateLink = cvUrl.trim()
      if (!candidateLink) {
        setErrorMsg('Please enter a valid URL for your Curriculum Vitae or switch to another CV option.')
        focusFieldIfOffscreen(cvUrlInputRef.current)
        return
      }
      if (!/^https?:\/\/.+/i.test(candidateLink)) {
        setErrorMsg('CV link must begin with http:// or https://.')
        focusFieldIfOffscreen(cvUrlInputRef.current)
        return
      }
    }
    if (!canSubmit) return

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

      // 2. Verify position is still open
      const latestPosSnap = await getDoc(doc(db, 'positions', position.id))
      if (!latestPosSnap.exists() || !latestPosSnap.data()?.isOpen) {
        setPosition((prev) => (prev ? { ...prev, isOpen: false } : prev))
        setErrorMsg('This research opportunity has been closed and is no longer accepting applications.')
        return
      }

      // 3. Resolve or upload CV according to the selected CV mode before starting Firestore submission
      let finalCvUrl = ''
      if (cvMode === 'profile') {
        const profileCv = (studentProfile.cvUrl || '').trim()
        if (!profileCv) {
          setErrorMsg('No saved profile CV was found. Please upload a CV file or provide an external CV link.')
          return
        }
        finalCvUrl = profileCv
      } else if (cvMode === 'link') {
        finalCvUrl = cvUrl.trim()
      } else if (cvMode === 'upload') {
        if (uploadedCvUrl.trim()) {
          finalCvUrl = uploadedCvUrl.trim()
        } else if (selectedCvFile) {
          setUploadingCv(true)
          try {
            finalCvUrl = await uploadApplicationCvFile(user.uid, position.id, selectedCvFile)
            setUploadedCvUrl(finalCvUrl)
          } catch (uploadErr) {
            console.error('Failed to upload CV file to Firebase Storage:', uploadErr)
            setErrorMsg(formatCvUploadError(uploadErr))
            return
          } finally {
            setUploadingCv(false)
          }
        }
      }

      // Persist newly provided/uploaded CV URL back to the student's profile for future applications
      if (finalCvUrl && finalCvUrl !== studentProfile.cvUrl && cvMode !== 'profile') {
        const updatedProfile = {
          ...studentProfile,
          cvUrl: finalCvUrl,
          updatedAt: new Date().toISOString(),
        }
        setStudentProfile(updatedProfile)
        saveSplitStudentProfile(
          user.uid,
          updatedProfile as unknown as Record<string, unknown>
        ).catch(() => {
          // Non-blocking profile CV update
        })
      }

      const now = new Date().toISOString()
      const applicationId = `app-${user.uid}-${position.id}`
      const resolvedPhotoURL = studentProfile.photoURL || user.photoURL || ''

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
        ...(finalCvUrl ? { cvUrl: finalCvUrl } : {}),
        ...(studentProfile.gpa
          ? {
              studentGpa: studentProfile.gpa,
              studentGpaScale: studentProfile.gpaScale || 4.0,
            }
          : {}),
        applicationStatement: statement.trim(),
        status: 'submitted',
        statusHistory: [
          {
            status: 'submitted',
            changedAt: now,
            note: 'Application submitted online',
          },
        ],
        submittedAt: now,
        updatedAt: now,
      }

      // 4. Atomically create the deterministic application document and the professor's notification
      const appRef = doc(db, 'applications', applicationId)
      const notifId = `notif_app_submitted_${applicationId}`
      const notifRef = doc(db, 'users', position.professorId, 'notifications', notifId)

      const batch = writeBatch(db)
      batch.set(appRef, {
        ...newApp,
        createdAt: serverTimestamp(),
      })
      batch.set(notifRef, {
        id: notifId,
        recipientId: position.professorId,
        actorId: user.uid,
        type: 'application_submitted',
        title: 'New Application Received',
        description: `${newApp.studentName} applied for ${position.title}.`,
        applicationId,
        positionId: position.id,
        isRead: false,
        createdAt: now,
      })
      await batch.commit()

      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit application to Firestore:', err)
      const firebaseCode = (err as { code?: string })?.code
      if (firebaseCode === 'permission-denied') {
        setErrorMsg(
          'Application submission was rejected by Firestore security rules (permission-denied). If firestore.rules was recently updated, ensure the latest rules are published to Firebase.'
        )
      } else {
        setErrorMsg(
          `Failed to submit your application${firebaseCode ? ` (${firebaseCode})` : ''}. Please check your connection and try again.`
        )
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

          {/* Left: Statement & Document Confirmation (or inline success state without collapsing page height) */}
          <div className="lg:col-span-2 space-y-6">
            {submitted ? (
              <div
                id="application-submitted-card"
                role="status"
                className="bg-white rounded-2xl border border-emerald-200 p-6 sm:p-8 shadow-xs space-y-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-display text-slate-900 tracking-tight">
                      Application Successfully Submitted!
                    </h2>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      Your application has been received by{' '}
                      <strong className="text-slate-900 font-semibold">{position.professorName}</strong>{' '}
                      at {position.university}.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2.5 text-slate-700">
                  <div className="flex justify-between gap-4 py-1 border-b border-slate-200/60">
                    <span className="text-slate-400">Position:</span>
                    <span className="font-semibold text-slate-900 text-right">{position.title}</span>
                  </div>
                  <div className="flex justify-between gap-4 py-1 border-b border-slate-200/60">
                    <span className="text-slate-400">Match Compatibility:</span>
                    <span className="font-bold text-blue-600">{matchResult.score}% Match Overlap</span>
                  </div>
                  <div className="flex justify-between gap-4 py-1">
                    <span className="text-slate-400">Current Status:</span>
                    <span className="font-semibold text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded">
                      Submitted / Awaiting Review
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
            ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Research Motivation
                </h2>
                <p className="text-xs font-semibold text-slate-800 mt-1.5">
                  Why are you interested in joining this research project? *
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Explain why you are interested in this specific research project, how your academic background or technical skills relate to it, and what you hope to learn or contribute.
                </p>
              </div>

              <div className="space-y-2">
                <textarea
                  ref={statementRef}
                  id="research-motivation-textarea"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  disabled={Boolean(existingApplication) || !isPositionOpen}
                  maxLength={2500}
                  placeholder={
                    existingApplication
                      ? 'You have already submitted an application for this position.'
                      : !isPositionOpen
                      ? 'Recruitment is closed for this position.'
                      : 'Explain your interest in this specific research project, how your coursework, research experience, or technical skills connect to the lab, and what you hope to learn or contribute (50–2,000 characters)...'
                  }
                  rows={7}
                  required
                  className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 p-3.5 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                />

                {!existingApplication && isPositionOpen && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span
                      id="motivation-validation-hint"
                      className={
                        statementLength === 0
                          ? 'text-slate-400'
                          : statementLength < MIN_STATEMENT_LENGTH
                          ? 'text-amber-600 font-medium'
                          : statementLength > MAX_STATEMENT_LENGTH
                          ? 'text-rose-600 font-semibold'
                          : 'text-emerald-600 font-medium'
                      }
                    >
                      {statementLength === 0
                        ? `Minimum ${MIN_STATEMENT_LENGTH} characters required`
                        : statementLength < MIN_STATEMENT_LENGTH
                        ? `${MIN_STATEMENT_LENGTH - statementLength} more character${
                            MIN_STATEMENT_LENGTH - statementLength === 1 ? '' : 's'
                          } needed (minimum ${MIN_STATEMENT_LENGTH})`
                        : statementLength > MAX_STATEMENT_LENGTH
                        ? `${statementLength - MAX_STATEMENT_LENGTH} characters over the ${MAX_STATEMENT_LENGTH}-character limit`
                        : 'Motivation statement meets length requirements'}
                    </span>

                    <span
                      id="motivation-char-counter"
                      className={`font-semibold ${
                        statementLength > MAX_STATEMENT_LENGTH
                          ? 'text-rose-600'
                          : statementLength >= MIN_STATEMENT_LENGTH
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {statementLength} / {MAX_STATEMENT_LENGTH} characters
                    </span>
                  </div>
                )}
              </div>

              {/* Application Documents (CV Handling: Profile CV / File Upload / Optional URL) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Curriculum Vitae (CV)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Attach your saved profile CV, upload a new PDF/DOC/DOCX file, or provide an external CV link.
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1 self-start">
                    {studentProfile.cvUrl?.trim() && (
                      <button
                        type="button"
                        disabled={Boolean(existingApplication) || !isPositionOpen}
                        onClick={() => setCvMode('profile')}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          cvMode === 'profile'
                            ? 'bg-white text-blue-600 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Saved Profile CV
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(existingApplication) || !isPositionOpen}
                      onClick={() => setCvMode('upload')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        cvMode === 'upload'
                          ? 'bg-white text-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Upload size={12} />
                      Upload File
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(existingApplication) || !isPositionOpen}
                      onClick={() => setCvMode('link')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        cvMode === 'link'
                          ? 'bg-white text-blue-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LinkIcon size={12} />
                      CV Link
                    </button>
                  </div>
                </div>

                {cvMode === 'profile' && studentProfile.cvUrl?.trim() && (
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-950">
                          Using CV from your Student Profile
                        </p>
                        <p className="text-[11px] text-emerald-800 truncate mt-0.5">
                          {studentProfile.cvUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={studentProfile.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <ExternalLink size={12} />
                        Preview CV
                      </a>
                      <button
                        type="button"
                        onClick={() => setCvMode('upload')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Replace CV
                      </button>
                    </div>
                  </div>
                )}

                {cvMode === 'upload' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 space-y-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleCvFileChange}
                      disabled={Boolean(existingApplication) || !isPositionOpen || uploadingCv}
                      className="hidden"
                      id="apply-cv-file"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-slate-800">
                          {uploadingCv
                            ? `Uploading ${selectedCvFile?.name || 'CV'} to Firebase Storage…`
                            : selectedCvFile
                            ? `Selected: ${selectedCvFile.name} (${(selectedCvFile.size / 1024 / 1024).toFixed(2)} MB)`
                            : 'Upload your Curriculum Vitae (PDF, DOC, or DOCX — max 10 MB)'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {uploadedCvUrl.trim()
                            ? 'CV uploaded and verified. Ready to submit your application.'
                            : 'Your uploaded CV will also be saved to your profile for future applications.'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(existingApplication) || !isPositionOpen || uploadingCv}
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs shrink-0"
                      >
                        <Upload size={13} className="mr-1.5" />
                        {selectedCvFile ? 'Choose Another File' : 'Choose CV File'}
                      </Button>
                    </div>
                  </div>
                )}

                {cvMode === 'link' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Curriculum Vitae (CV) External Link (Google Drive, Dropbox, Personal Site, etc.)
                    </label>
                    <input
                      ref={cvUrlInputRef}
                      type="url"
                      value={cvUrl}
                      onChange={(e) => setCvUrl(e.target.value)}
                      disabled={Boolean(existingApplication) || !isPositionOpen}
                      placeholder="https://example.com/your-cv.pdf"
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                      id="apply-cv-url"
                    />
                  </div>
                )}
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs font-medium text-rose-700 flex items-center gap-2.5"
                >
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {existingApplication
                    ? 'Application already submitted'
                    : !isPositionOpen
                    ? 'Recruitment closed'
                    : 'Ready for faculty review upon submission'}
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
                  {existingApplication
                    ? 'Already Applied'
                    : uploadingCv
                    ? 'Uploading CV…'
                    : loading
                    ? 'Submitting Application…'
                    : 'Submit Formal Application'}
                </Button>
              </div>
            </form>
            )}
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
