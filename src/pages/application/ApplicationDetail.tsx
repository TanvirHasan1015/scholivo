import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import {
  ArrowLeft, CheckCircle2, Clock, FileText, ExternalLink,
  MessageSquare, Sparkles, Building, Calendar, GraduationCap,
  Award, Globe, Check, AlertCircle, X, FileCheck, ShieldAlert
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Application, ApplicationStatus } from '@/types/application.types'
import type { StudentProfile, ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import { computeMatch } from '@/lib/matching'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchScoreBadge, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { STATUS_LABELS, formatDate } from '@/utils/helpers'

const ALL_STATUSES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'shortlisted',
  'interview',
  'accepted'
]

const STATUS_PILL_STYLES: Record<string, string> = {
  submitted: 'bg-slate-100 text-slate-700 border-slate-200',
  under_review: 'bg-blue-50 text-blue-700 border-blue-200',
  shortlisted: 'bg-amber-50 text-amber-700 border-amber-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function ApplicationDetail() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [app, setApp] = useState<Application | null>(null)
  const [candidateProfile, setCandidateProfile] = useState<StudentProfile | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [selectedNewStatus, setSelectedNewStatus] = useState<ApplicationStatus | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const isUpdatingRef = useRef(false)

  // Faculty verification status (defaults to pending until confirmed from Firestore)
  const [profVerificationStatus, setProfVerificationStatus] = useState<string>('pending')

  useEffect(() => {
    if (authLoading) return
    let isMounted = true

    async function loadApplicationData() {
      if (!applicationId || !user) {
        if (isMounted) setLoading(false)
        return
      }

      if (isMounted) {
        setLoading(true)
        setNotFound(false)
        setUnauthorized(false)
        setApp(null)
        setCandidateProfile(null)
        setPosition(null)
      }

      try {
        let currentProfStatus = 'pending'
        if (role === 'professor') {
          const profSnap = await getDoc(doc(db, 'professors', user.uid))
          if (!isMounted) return
          if (profSnap.exists()) {
            const profData = profSnap.data() as ProfessorProfile
            currentProfStatus = profData.verificationStatus || 'pending'
          }
          setProfVerificationStatus(currentProfStatus)
          if (currentProfStatus !== 'verified') {
            return
          }
        }

        const snap = await getDoc(doc(db, 'applications', applicationId))
        if (!isMounted) return

        if (!snap.exists()) {
          setNotFound(true)
          return
        }

        const data = { ...(snap.data() as Application), id: snap.id }

        // Enforce positive ownership allowlist
        const isOwner =
          (role === 'student' && data.studentId === user.uid) ||
          (role === 'professor' && data.professorId === user.uid) ||
          role === 'admin'

        if (!isOwner) {
          setUnauthorized(true)
          return
        }

        setApp(data)

        const [studentSnap, positionSnap] = await Promise.all([
          data.studentId ? getDoc(doc(db, 'students', data.studentId)) : Promise.resolve(null),
          data.positionId ? getDoc(doc(db, 'positions', data.positionId)) : Promise.resolve(null),
        ])

        if (!isMounted) return

        if (studentSnap && studentSnap.exists()) {
          const studentData = studentSnap.data() as StudentProfile
          setCandidateProfile({
            ...studentData,
            uid: studentData.uid || studentSnap.id,
            researchInterests: Array.isArray(studentData.researchInterests) ? studentData.researchInterests : [],
            researchAreas: Array.isArray(studentData.researchAreas) ? studentData.researchAreas : [],
            researchExperience: Array.isArray(studentData.researchExperience) ? studentData.researchExperience : [],
            projects: Array.isArray(studentData.projects) ? studentData.projects : [],
            publications: Array.isArray(studentData.publications) ? studentData.publications : [],
            programmingLanguages: Array.isArray(studentData.programmingLanguages) ? studentData.programmingLanguages : [],
            frameworks: Array.isArray(studentData.frameworks) ? studentData.frameworks : [],
            technicalSkills: Array.isArray(studentData.technicalSkills) ? studentData.technicalSkills : [],
            researchTools: Array.isArray(studentData.researchTools) ? studentData.researchTools : [],
            languageScores: Array.isArray(studentData.languageScores) ? studentData.languageScores : [],
          })
        }

        if (positionSnap && positionSnap.exists()) {
          const posData = positionSnap.data() as Position
          setPosition({
            ...posData,
            id: positionSnap.id,
            requiredSkills: Array.isArray(posData.requiredSkills) ? posData.requiredSkills : [],
            preferredSkills: Array.isArray(posData.preferredSkills) ? posData.preferredSkills : [],
          })
        }
      } catch (err) {
        console.error('Error loading application detail from Firestore:', err)
        if (isMounted) setNotFound(true)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadApplicationData()
    return () => {
      isMounted = false
    }
  }, [applicationId, user, role, authLoading])

  const matchedKeywords = useMemo(() => {
    if (candidateProfile && position) {
      return computeMatch(candidateProfile, position).matchedKeywords
    }
    return []
  }, [candidateProfile, position])

  const handleInitiateStatusChange = (newStatus: ApplicationStatus) => {
    if (app && app.status === newStatus) return
    setSelectedNewStatus(newStatus)
    setStatusNote('')
    setUpdateError(null)
    setShowNoteModal(true)
  }

  const handleConfirmStatusChange = async () => {
    if (isUpdatingRef.current) return
    if (!app || !selectedNewStatus || !user) return
    if (app.status === selectedNewStatus) {
      setShowNoteModal(false)
      return
    }
    if (role !== 'professor' || profVerificationStatus !== 'verified' || app.professorId !== user.uid) {
      setUpdateError('Only verified faculty who own this position may update candidate application status.')
      return
    }

    isUpdatingRef.current = true
    setIsUpdating(true)
    setUpdateError(null)

    const now = new Date().toISOString()
    const newNote = statusNote.trim() || `Status updated to ${STATUS_LABELS[selectedNewStatus]}`
    const updatedHistory = [
      ...(app.statusHistory || []),
      {
        status: selectedNewStatus,
        changedAt: now,
        note: newNote,
      },
    ]

    try {
      await updateDoc(doc(db, 'applications', app.id), {
        status: selectedNewStatus,
        statusHistory: updatedHistory,
        updatedAt: now,
      })

      setApp({
        ...app,
        status: selectedNewStatus,
        statusHistory: updatedHistory,
        updatedAt: now,
      })
      setShowNoteModal(false)
      setSuccessToast(`Application marked as "${STATUS_LABELS[selectedNewStatus]}"`)
      setTimeout(() => setSuccessToast(null), 3500)
    } catch (err) {
      console.error('Failed to update application status in Firestore:', err)
      setUpdateError('Failed to save application status update. Please try again.')
    } finally {
      isUpdatingRef.current = false
      setIsUpdating(false)
    }
  }

  const isProf = role === 'professor'

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-4 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-slate-500">Loading candidate application dossier...</p>
      </div>
    )
  }

  // Restrict access for unverified faculty
  if (isProf && profVerificationStatus !== 'verified') {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xs space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
            <ShieldAlert size={32} />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-800 border border-amber-200 uppercase tracking-wider mb-2">
              Verification Required
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
              Application Dossier Review Restricted
            </h2>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            Your faculty institutional affiliation is currently{' '}
            <strong className="text-amber-800 capitalize font-semibold">{profVerificationStatus.replace('_', ' ')}</strong>.
            To protect applicant privacy and academic confidentiality, only verified faculty may inspect candidate dossiers, transcripts, and statement letters.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/dashboard/professor')} className="text-xs">
              Return to Professor Dashboard
            </Button>
            <Button variant="primary" onClick={() => navigate('/profile/professor/edit')} className="text-xs bg-blue-600 text-white">
              Edit Lab Profile
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xs space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
            Access Restricted
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            You do not have permission to view this application dossier. Only the submitting student and the professor who owns this position may view it.
          </p>
          <div className="pt-3 flex items-center justify-center">
            <Button variant="secondary" onClick={() => navigate(isProf ? '/dashboard/professor' : '/applications')} className="text-xs">
              Return to {isProf ? 'Professor Dashboard' : 'My Applications'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !app) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xs space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
            Application Not Found
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            The requested application dossier could not be found in the database.
          </p>
          <div className="pt-3 flex items-center justify-center">
            <Button variant="secondary" onClick={() => navigate(isProf ? '/dashboard/professor' : '/applications')} className="text-xs">
              Return to {isProf ? 'Professor Dashboard' : 'My Applications'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-20 pb-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Back button & Toast */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(isProf ? '/dashboard/professor' : '/applications')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-200/60"
          >
            <ArrowLeft size={14} />
            Back to {isProf ? 'Professor Dashboard' : 'My Applications'}
          </button>

          {successToast && (
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-medium animate-fadeIn">
              <CheckCircle2 size={14} className="text-emerald-600" />
              {successToast}
            </div>
          )}
        </div>

        {/* Header Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start sm:items-center gap-4">
              <Avatar
                src={app.studentPhotoURL}
                name={app.studentName}
                size="lg"
                className="w-16 h-16 rounded-2xl border border-slate-200 text-lg font-bold"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                    {app.studentName}
                  </h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_PILL_STYLES[app.status]}`}>
                    {STATUS_LABELS[app.status]}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Building size={14} className="text-blue-600" />
                  Applying for: <span className="font-semibold text-slate-900">{app.positionTitle}</span>
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  <span>Lab: {app.professorName}</span>
                  <span>•</span>
                  <span>{app.university}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    Submitted: {formatDate(app.submittedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/messages')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              >
                <MessageSquare size={14} className="mr-1.5 text-blue-600" />
                {isProf ? 'Message Student' : 'Message Lab'}
              </Button>
            </div>
          </div>

          {/* Timeline Visualizer */}
          <div className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider font-bold text-slate-400">
                Application Progression Stage
              </h2>
              {app.status === 'rejected' && (
                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                  Application Declined
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {ALL_STATUSES.map((st, idx) => {
                const currentIdx = ALL_STATUSES.indexOf(app.status)
                const isPassed = app.status !== 'rejected' && currentIdx >= idx
                const isCurrent = app.status === st

                return (
                  <div
                    key={st}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isCurrent
                        ? 'bg-blue-50/80 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/30'
                        : isPassed
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {isCurrent ? (
                        <Clock size={12} className="text-blue-600 animate-pulse" />
                      ) : isPassed ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                      )}
                      <span className="text-[11px] font-semibold">{STATUS_LABELS[st]}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isCurrent ? 'Current Stage' : isPassed ? 'Completed' : 'Pending'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Professor Quick Status Management Bar */}
          {isProf && (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileCheck size={16} className="text-blue-600" />
                <span className="text-xs font-semibold text-slate-800">
                  Update Candidate Stage:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('under_review')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    app.status === 'under_review'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Under Review
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('shortlisted')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    app.status === 'shortlisted'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Shortlist
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('interview')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    app.status === 'interview'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Interview
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('accepted')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    app.status === 'accepted'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('rejected')}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    app.status === 'rejected'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Grid: Left Dossier / Right Match & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Cols: Academic Profile, Statement, Documents */}
          <div className="lg:col-span-2 space-y-6">

            {/* Candidate Academic Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                  <GraduationCap size={18} className="text-blue-600" />
                  Applicant Academic Profile
                </h3>
                {candidateProfile?.gpa && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    GPA: {candidateProfile.gpa} / {candidateProfile.gpaScale || 4.0}
                  </span>
                )}
              </div>

              {/* Education grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Institution & Major</span>
                  <p className="font-semibold text-slate-900 text-sm">
                    {candidateProfile?.university || app.university}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {candidateProfile?.major || 'Not specified'} • {candidateProfile?.degree || 'Not specified'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">Graduation Timeline</span>
                  <p className="font-semibold text-slate-900 text-sm">
                    {candidateProfile?.expectedGraduation ? `Graduating ${candidateProfile.expectedGraduation}` : 'Not specified'}
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {candidateProfile?.currentSemester || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Language Scores */}
              {candidateProfile?.languageScores && candidateProfile.languageScores.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Standardized Language Scores
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {candidateProfile.languageScores.map((ls, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800">
                        <Award size={14} className="text-amber-500" />
                        <span>{ls.type}: <strong>{ls.score}</strong></span>
                        {ls.date && <span className="text-slate-400 text-[10px]">({ls.date})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Research Interests */}
              {candidateProfile?.researchInterests && candidateProfile.researchInterests.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Primary Research Interests
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {candidateProfile.researchInterests.map((interest, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Skills */}
              {candidateProfile?.technicalSkills && candidateProfile.technicalSkills.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Technical Skills & Tools
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {candidateProfile.technicalSkills.map((skill, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Applicant Research / Motivation Statement */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Applicant Research Statement & Motivation
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line italic">
                  "{app.applicationStatement}"
                </p>
              </div>
            </div>

            {/* Submitted Documents Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <FileCheck size={18} className="text-blue-600" />
                Submitted Application Documents
              </h3>

              <div className="space-y-3">
                {/* CV Card */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      PDF
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Curriculum Vitae (CV)</p>
                      <p className="text-xs text-slate-500">Applicant verified academic credentials</p>
                    </div>
                  </div>
                  <a
                    href={app.cvUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    View CV <ExternalLink size={12} />
                  </a>
                </div>

                {/* Transcript Card */}
                {app.transcriptUrl && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Official Academic Transcript</p>
                        <p className="text-xs text-slate-500">Verified university course grades & credits</p>
                      </div>
                    </div>
                    <a
                      href={app.transcriptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      View Transcript <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Portfolio URL if exists */}
                {candidateProfile?.portfolioUrl && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                        <Globe size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Research Portfolio / GitHub</p>
                        <p className="text-xs text-slate-500">{candidateProfile.portfolioUrl}</p>
                      </div>
                    </div>
                    <a
                      href={candidateProfile.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      Visit Link <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Col: Profile Match Analysis & Activity Timeline */}
          <div className="space-y-6">

            {/* Profile Match Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles size={16} className="text-blue-600" />
                Profile Match Analysis
              </h3>

              <div className="flex flex-col items-center justify-center py-2">
                <MatchScoreBadge score={app.matchScore} size="lg" />
                <p className="text-xs text-slate-600 text-center mt-3 px-2 leading-relaxed">
                  {app.matchExplanation}
                </p>
              </div>

              {app.matchBreakdown && (
                <div className="pt-2">
                  <MatchBreakdownPanel
                    result={{
                      score: app.matchScore,
                      breakdown: app.matchBreakdown,
                      explanation: app.matchExplanation,
                      matchedKeywords,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Activity History Log */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 pb-2 border-b border-slate-100">
                Application Review History
              </h4>

              <div className="space-y-4 relative before:absolute before:top-2 before:bottom-2 before:left-2.5 before:w-0.5 before:bg-slate-200">
                {(app.statusHistory || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 relative pl-6">
                    <div className="absolute left-1.5 top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-slate-900">
                        {STATUS_LABELS[item.status]}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {formatDate(item.changedAt)}
                      </div>
                      {item.note && (
                        <div className="text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1">
                          "{item.note}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Status Note Dialog Modal */}
      {showNoteModal && selectedNewStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Update Status to "{STATUS_LABELS[selectedNewStatus]}"
              </h3>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are updating {app.studentName}'s application for <strong>{app.positionTitle}</strong>. You may optionally add an evaluation note for your lab records.
            </p>

            {updateError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Evaluation / Action Note (Optional)
              </label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={
                  selectedNewStatus === 'interview'
                    ? 'e.g., Scheduled technical discussion for next Tuesday via Zoom.'
                    : selectedNewStatus === 'shortlisted'
                    ? 'e.g., Impressive MICCAI paper, shortlisted for top 3 candidates.'
                    : selectedNewStatus === 'accepted'
                    ? 'e.g., Recommended for fully funded departmental scholarship.'
                    : 'e.g., Evaluation note...'
                }
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNoteModal(false)}
                className="text-xs text-slate-600"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmStatusChange}
                disabled={isUpdating}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Confirm Update
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
