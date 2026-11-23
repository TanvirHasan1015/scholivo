import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, writeBatch } from 'firebase/firestore'
import {
  ArrowLeft, CheckCircle2, Clock, FileText, ExternalLink,
  MessageSquare, Sparkles, Building, Calendar, GraduationCap,
  Award, Globe, Check, AlertCircle, X, FileCheck, ShieldAlert, Video
} from 'lucide-react'
import { db } from '@/lib/firebase'
import {
  formatInterviewDateTime,
  toDateTimeLocalInputValue,
  validateMeetingUrl,
} from '@/lib/notifications'
import { useAuth } from '@/context/AuthContext'
import type { Application, ApplicationStatus } from '@/types/application.types'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import { computeMatch } from '@/lib/matching'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchScoreBadge, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { STATUS_LABELS, formatDate } from '@/utils/helpers'

const ALL_STATUSES: ApplicationStatus[] = [
  'submitted',
  'under_review',
  'interview',
  'accepted'
]

const STATUS_PILL_STYLES: Record<string, string> = {
  submitted: 'bg-slate-100 text-slate-700 border-slate-200',
  under_review: 'bg-blue-50 text-blue-700 border-blue-200',
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
  const [interviewDateTimeInput, setInterviewDateTimeInput] = useState('')
  const [interviewMeetingUrlInput, setInterviewMeetingUrlInput] = useState('')
  const [interviewInstructionsInput, setInterviewInstructionsInput] = useState('')
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const isUpdatingRef = useRef(false)

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
          (role === 'professor' && data.professorId === user.uid)

        if (!isOwner) {
          setUnauthorized(true)
          return
        }

        setApp(data)

        const [studentRes, positionRes, profRes] = await Promise.allSettled([
          data.studentId ? getDoc(doc(db, 'students', data.studentId)) : Promise.resolve(null),
          data.positionId ? getDoc(doc(db, 'positions', data.positionId)) : Promise.resolve(null),
          data.professorId ? getDoc(doc(db, 'professors', data.professorId)) : Promise.resolve(null),
        ])

        if (!isMounted) return

        const profData =
          profRes.status === 'fulfilled' && profRes.value && profRes.value.exists()
            ? (profRes.value.data() as ProfessorProfile)
            : null

        if (studentRes.status === 'fulfilled' && studentRes.value && studentRes.value.exists()) {
          const studentData = studentRes.value.data() as StudentProfile
          setCandidateProfile({
            ...studentData,
            uid: studentData.uid || studentRes.value.id,
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

        if (positionRes.status === 'fulfilled' && positionRes.value && positionRes.value.exists()) {
          const posData = positionRes.value.data() as Position
          setPosition({
            ...posData,
            id: positionRes.value.id,
            professorName: profData?.fullName || posData.professorName || data.professorName,
            university: profData?.university || posData.university || data.university,
            department: profData?.department || posData.department || '',
            requiredSkills: Array.isArray(posData.requiredSkills) ? posData.requiredSkills : [],
            preferredSkills: Array.isArray(posData.preferredSkills) ? posData.preferredSkills : [],
          })
        }

        if (profData) {
          setApp((prev) =>
            prev
              ? {
                  ...prev,
                  professorName: profData.fullName || prev.professorName,
                  university: profData.university || prev.university,
                }
              : prev
          )
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
    if (!app) return
    if (app.status === 'accepted' || app.status === 'rejected') return
    if (app.status === newStatus) {
      if (newStatus === 'interview') {
        handleInitiateReschedule()
      }
      return
    }
    setIsRescheduling(false)
    setSelectedNewStatus(newStatus)
    setInterviewDateTimeInput(newStatus === 'interview' ? toDateTimeLocalInputValue(app.interviewAt) : '')
    setInterviewMeetingUrlInput(newStatus === 'interview' ? app.interviewMeetingUrl || '' : '')
    setInterviewInstructionsInput(newStatus === 'interview' ? app.interviewInstructions || '' : '')
    setStatusNote('')
    setUpdateError(null)
    setShowNoteModal(true)
  }

  const handleInitiateReschedule = () => {
    if (!app || app.status !== 'interview') return
    setIsRescheduling(true)
    setSelectedNewStatus('interview')
    setInterviewDateTimeInput(toDateTimeLocalInputValue(app.interviewAt))
    setInterviewMeetingUrlInput(app.interviewMeetingUrl || '')
    setInterviewInstructionsInput(app.interviewInstructions || '')
    setStatusNote('')
    setUpdateError(null)
    setShowNoteModal(true)
  }

  const handleConfirmStatusChange = async () => {
    if (isUpdatingRef.current) return
    if (!app || !selectedNewStatus || !user) return
    if (app.status === 'accepted' || app.status === 'rejected') {
      setShowNoteModal(false)
      return
    }
    if (role !== 'professor' || app.professorId !== user.uid) {
      setUpdateError('Only the professor who owns this position may update candidate application status.')
      return
    }

    let nextInterviewIso: string | undefined
    let normalizedMeetingUrl = ''
    let trimmedInstructions = ''
    if (selectedNewStatus === 'interview') {
      const parsed = Date.parse(interviewDateTimeInput)
      if (!interviewDateTimeInput.trim() || Number.isNaN(parsed)) {
        setUpdateError('Please select a valid interview date and time.')
        return
      }
      const urlCheck = validateMeetingUrl(interviewMeetingUrlInput)
      if (!urlCheck.valid) {
        setUpdateError(urlCheck.error || 'Please enter a valid Zoom or meeting URL.')
        return
      }
      normalizedMeetingUrl = urlCheck.normalized
      trimmedInstructions = interviewInstructionsInput.trim()
      if (trimmedInstructions.length > 2000) {
        setUpdateError('Interview instructions must be 2,000 characters or fewer.')
        return
      }
      nextInterviewIso = new Date(parsed).toISOString()
      const dateChanged = nextInterviewIso !== app.interviewAt
      const urlChanged = normalizedMeetingUrl !== (app.interviewMeetingUrl || '')
      const instructionsChanged = trimmedInstructions !== (app.interviewInstructions || '')
      if (isRescheduling && !dateChanged && !urlChanged && !instructionsChanged) {
        setUpdateError('Please update the interview date/time, meeting link, or instructions.')
        return
      }
    } else if (app.status === selectedNewStatus) {
      setShowNoteModal(false)
      return
    }

    isUpdatingRef.current = true
    setIsUpdating(true)
    setUpdateError(null)

    const now = new Date().toISOString()
    const formattedSchedule = nextInterviewIso ? formatInterviewDateTime(nextInterviewIso) : ''
    const defaultNote =
      selectedNewStatus === 'interview'
        ? isRescheduling
          ? `Interview rescheduled for ${formattedSchedule}`
          : `Interview scheduled for ${formattedSchedule}`
        : `Status updated to ${STATUS_LABELS[selectedNewStatus]}`
    const newNote = statusNote.trim() || defaultNote
    const updatedHistory = [
      ...(app.statusHistory || []),
      {
        status: selectedNewStatus,
        changedAt: now,
        note: newNote,
      },
    ]

    const notifType =
      selectedNewStatus === 'interview'
        ? isRescheduling
          ? 'interview_rescheduled'
          : 'interview_scheduled'
        : 'application_status_changed'
    const notifTitle =
      notifType === 'interview_scheduled'
        ? 'Interview Scheduled'
        : notifType === 'interview_rescheduled'
        ? 'Interview Rescheduled'
        : 'Application Status Updated'
    const notifDescription =
      notifType === 'interview_scheduled'
        ? `${app.professorName} scheduled an interview for ${app.positionTitle} on ${formattedSchedule}${normalizedMeetingUrl ? ' (meeting link included)' : ''}.`
        : notifType === 'interview_rescheduled'
        ? `${app.professorName} updated the interview details for ${app.positionTitle} (${formattedSchedule}${normalizedMeetingUrl ? ', meeting link included' : ''}).`
        : `Your application for ${app.positionTitle} is now ${STATUS_LABELS[selectedNewStatus]}.`
    const notifId = `notif_app_${app.id}_h_${updatedHistory.length}`

    try {
      const batch = writeBatch(db)
      const updateFields: Record<string, unknown> = {
        status: selectedNewStatus,
        statusHistory: updatedHistory,
        updatedAt: now,
      }
      if (selectedNewStatus === 'interview' && nextInterviewIso) {
        updateFields.interviewAt = nextInterviewIso
        updateFields.interviewMeetingUrl = normalizedMeetingUrl
        updateFields.interviewInstructions = trimmedInstructions
      }
      batch.update(doc(db, 'applications', app.id), updateFields)
      batch.set(doc(db, 'users', app.studentId, 'notifications', notifId), {
        id: notifId,
        recipientId: app.studentId,
        actorId: user.uid,
        type: notifType,
        title: notifTitle,
        description: notifDescription,
        applicationId: app.id,
        positionId: app.positionId,
        isRead: false,
        createdAt: now,
      })
      await batch.commit()

      setApp({
        ...app,
        status: selectedNewStatus,
        ...(selectedNewStatus === 'interview' && nextInterviewIso
          ? {
              interviewAt: nextInterviewIso,
              interviewMeetingUrl: normalizedMeetingUrl,
              interviewInstructions: trimmedInstructions,
            }
          : {}),
        statusHistory: updatedHistory,
        updatedAt: now,
      })
      setShowNoteModal(false)
      setSuccessToast(
        isRescheduling
          ? `Interview rescheduled for ${formattedSchedule}`
          : `Application marked as "${STATUS_LABELS[selectedNewStatus]}"`
      )
      setTimeout(() => setSuccessToast(null), 3500)
    } catch (err) {
      console.error('Failed to update application status in Firestore:', err)
      const firebaseCode = (err as { code?: string })?.code
      if (firebaseCode === 'permission-denied') {
        setUpdateError(
          'Failed to save application status update (permission-denied). Ensure the latest firestore.rules are published to Firebase and you own this position.'
        )
      } else {
        setUpdateError(
          `Failed to save application status update${firebaseCode ? ` (${firebaseCode})` : ''}. Please try again.`
        )
      }
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
                src={candidateProfile?.photoURL ?? app.studentPhotoURL}
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
                onClick={() => {
                  const targetUid = isProf ? app.studentId : app.professorId
                  if (!targetUid) {
                    navigate('/messages')
                    return
                  }
                  const params = new URLSearchParams({
                    to: targetUid,
                    context: app.positionTitle || 'Application Inquiry',
                    name: isProf ? app.studentName || 'Student Applicant' : app.professorName || 'Faculty Member',
                    role: isProf ? 'student' : 'professor',
                    university: isProf ? candidateProfile?.university || '' : app.university || '',
                    department: isProf ? candidateProfile?.department || '' : '',
                    headline: isProf ? 'Student Applicant' : 'Professor',
                  })
                  if (app.positionId) {
                    params.set('positionId', app.positionId)
                  }
                  navigate(`/messages?${params.toString()}`)
                }}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                id="message-counterpart-btn"
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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

          {/* Scheduled Interview Banner */}
          {app.interviewAt && (
            <div
              className="mt-5 p-4 sm:p-5 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-3"
              id="interview-schedule-banner"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                      Scheduled Interview
                    </p>
                    <p className="text-sm font-semibold text-purple-900 mt-0.5">
                      {formatInterviewDateTime(app.interviewAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {app.interviewMeetingUrl && (
                    <a
                      href={app.interviewMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      id="join-zoom-meeting-link"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <Video size={14} />
                      <span>Join Zoom Meeting</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {isProf && app.status === 'interview' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleInitiateReschedule}
                      className="text-xs border-purple-300 text-purple-800 hover:bg-purple-100 shrink-0"
                      id="reschedule-interview-btn"
                    >
                      Edit / Reschedule Interview
                    </Button>
                  )}
                </div>
              </div>

              {(app.interviewMeetingUrl || app.interviewInstructions) && (
                <div className="pt-3 border-t border-purple-200/80 space-y-2 text-xs text-purple-900">
                  {app.interviewMeetingUrl && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-purple-950">Meeting Link:</span>
                      <a
                        href={app.interviewMeetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-700 hover:text-purple-900 underline break-all"
                      >
                        {app.interviewMeetingUrl}
                      </a>
                    </div>
                  )}
                  {app.interviewInstructions && (
                    <div
                      id="interview-instructions-display"
                      className="p-3 rounded-xl bg-white/80 border border-purple-200/70 text-slate-700 whitespace-pre-line leading-relaxed"
                    >
                      <span className="block text-[11px] font-bold text-purple-950 uppercase tracking-wider mb-1">
                        Interview Instructions
                      </span>
                      {app.interviewInstructions}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Professor Quick Status Management Bar */}
          {isProf && app.status !== 'accepted' && app.status !== 'rejected' && (
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
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateStatusChange('rejected')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all bg-white text-rose-600 border-rose-200 hover:bg-rose-50"
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
                {(app.studentGpa || candidateProfile?.gpa) && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                    GPA: {app.studentGpa ?? candidateProfile?.gpa} /{' '}
                    {app.studentGpaScale ?? candidateProfile?.gpaScale ?? 4.0}
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

              {/* Technical Skills, Programming Languages, Frameworks & Tools */}
              {(() => {
                const allApplicantSkills = Array.from(
                  new Set([
                    ...(candidateProfile?.programmingLanguages || []),
                    ...(candidateProfile?.frameworks || []),
                    ...(candidateProfile?.technicalSkills || []),
                    ...(candidateProfile?.researchTools || []),
                  ])
                )
                return allApplicantSkills.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Technical Skills & Tools
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {allApplicantSkills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}

              {/* Prior Research Experience */}
              {candidateProfile?.researchExperience &&
                candidateProfile.researchExperience.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Prior Research Experience ({candidateProfile.researchExperience.length})
                    </h4>
                    <div className="space-y-2.5">
                      {candidateProfile.researchExperience.map((exp, idx) => (
                        <div
                          key={exp.id || idx}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{exp.title}</span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate || 'Completed'}
                            </span>
                          </div>
                          <p className="font-semibold text-blue-700">
                            {exp.role} • {exp.organization}
                          </p>
                          {exp.description && (
                            <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Publications */}
              {candidateProfile?.publications && candidateProfile.publications.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Publications & Papers ({candidateProfile.publications.length})
                  </h4>
                  <div className="space-y-2">
                    {candidateProfile.publications.map((pub, idx) => (
                      <div
                        key={pub.id || idx}
                        className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/70 text-xs space-y-0.5"
                      >
                        <p className="font-bold text-slate-900">{pub.title}</p>
                        <p className="text-slate-600">
                          {pub.conference || pub.journal} ({pub.year})
                          {pub.authors && pub.authors.length > 0
                            ? ` • ${pub.authors.join(', ')}`
                            : ''}
                        </p>
                        {pub.doi && (
                          <p className="text-[10px] text-blue-600 font-mono">DOI: {pub.doi}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Research Motivation Section */}
            <div
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4"
              id="research-motivation-section"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  Research Motivation
                </h3>
                <span className="text-[11px] font-medium text-slate-400">
                  Submitted with application
                </span>
              </div>
              <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/80">
                <p
                  id="research-motivation-content"
                  className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words"
                >
                  {app.applicationStatement}
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
                {app.cvUrl ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        PDF
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Curriculum Vitae (CV)</p>
                        <p className="text-xs text-slate-500">Applicant academic credentials</p>
                      </div>
                    </div>
                    <a
                      href={app.cvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      View CV <ExternalLink size={12} />
                    </a>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500">
                    No CV URL attached to this application.
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
                {isRescheduling
                  ? 'Reschedule Interview'
                  : `Update Status to "${STATUS_LABELS[selectedNewStatus]}"`}
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
              {isRescheduling
                ? `Choose a new interview date and time for ${app.studentName} (${app.positionTitle}).`
                : <>You are updating {app.studentName}'s application for <strong>{app.positionTitle}</strong>. You may optionally add an evaluation note for your lab records.</>}
            </p>

            {updateError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            {selectedNewStatus === 'interview' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="interview-datetime-input">
                    Interview Date & Time (Required)
                  </label>
                  <input
                    id="interview-datetime-input"
                    type="datetime-local"
                    value={interviewDateTimeInput}
                    onChange={(e) => setInterviewDateTimeInput(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="interview-meeting-url-input">
                    Zoom / Meeting Link (Optional)
                  </label>
                  <input
                    id="interview-meeting-url-input"
                    type="url"
                    value={interviewMeetingUrlInput}
                    onChange={(e) => setInterviewMeetingUrlInput(e.target.value)}
                    placeholder="https://zoom.us/j/123456789"
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="interview-instructions-input">
                    Interview Instructions for Student (Optional)
                  </label>
                  <textarea
                    id="interview-instructions-input"
                    value={interviewInstructionsInput}
                    onChange={(e) => setInterviewInstructionsInput(e.target.value)}
                    placeholder="e.g., Please join 5 minutes early and prepare a brief overview of your research."
                    rows={3}
                    className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-purple-600/30 focus:border-purple-600"
                  />
                </div>
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
