import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import {
  ArrowLeft, Send, Sparkles, FileText, CheckCircle2,
  Building, AlertCircle, GraduationCap, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Position } from '@/types/position.types'
import type { StudentProfile } from '@/types/user.types'
import type { Application } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { computeMatch } from '@/lib/matching'
import { MatchScoreBadge, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { FUNDING_LABELS } from '@/utils/helpers'

function normalizeStudent(raw: Partial<StudentProfile>, uid: string): StudentProfile {
  return {
    uid: raw.uid || uid,
    fullName: raw.fullName ?? '',
    username: raw.username ?? '',
    email: raw.email ?? '',
    country: raw.country ?? '',
    photoURL: raw.photoURL,
    university: raw.university ?? '',
    department: raw.department ?? '',
    major: raw.major ?? '',
    degree: raw.degree ?? 'Master',
    currentSemester: raw.currentSemester ?? '',
    expectedGraduation: raw.expectedGraduation ?? '',
    gpa: typeof raw.gpa === 'number' ? raw.gpa : 0,
    gpaScale: typeof raw.gpaScale === 'number' ? raw.gpaScale : 4.0,
    researchInterests: Array.isArray(raw.researchInterests) ? raw.researchInterests : [],
    researchAreas: Array.isArray(raw.researchAreas) ? raw.researchAreas : [],
    researchExperience: Array.isArray(raw.researchExperience) ? raw.researchExperience : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    publications: Array.isArray(raw.publications) ? raw.publications : [],
    programmingLanguages: Array.isArray(raw.programmingLanguages) ? raw.programmingLanguages : [],
    frameworks: Array.isArray(raw.frameworks) ? raw.frameworks : [],
    technicalSkills: Array.isArray(raw.technicalSkills) ? raw.technicalSkills : [],
    researchTools: Array.isArray(raw.researchTools) ? raw.researchTools : [],
    languageScores: Array.isArray(raw.languageScores) ? raw.languageScores : [],
    cvUrl: raw.cvUrl ?? '',
    transcriptUrl: raw.transcriptUrl ?? '',
    portfolioUrl: raw.portfolioUrl ?? '',
    profileCompleteness: raw.profileCompleteness ?? 0,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  }
}

export default function Apply() {
  const { positionId } = useParams<{ positionId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [position, setPosition] = useState<Position | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [statement, setStatement] = useState('')
  const [cvUrl, setCvUrl] = useState('')
  const [transcriptUrl, setTranscriptUrl] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadApplyData = useCallback(async () => {
    if (!positionId || !user) {
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    setLoadError('')

    try {
      // 1. Load Position from Firestore
      const posSnap = await getDoc(doc(db, 'positions', positionId))
      if (!posSnap.exists()) {
        setPosition(null)
        setPageLoading(false)
        return
      }
      const rawPos = posSnap.data() as Partial<Position>
      const loadedPos: Position = {
        ...(rawPos as Position),
        id: posSnap.id,
        researchTopics: Array.isArray(rawPos.researchTopics) ? rawPos.researchTopics : [],
        requiredSkills: Array.isArray(rawPos.requiredSkills) ? rawPos.requiredSkills : [],
        preferredSkills: Array.isArray(rawPos.preferredSkills) ? rawPos.preferredSkills : [],
        languageRequirements: Array.isArray(rawPos.languageRequirements) ? rawPos.languageRequirements : [],
        researchArea: rawPos.researchArea ?? '',
      }
      setPosition(loadedPos)

      // 2. Load Student Profile from Firestore
      let loadedStudent: StudentProfile | null = null
      const directSnap = await getDoc(doc(db, 'students', user.uid))
      if (directSnap.exists()) {
        loadedStudent = normalizeStudent(directSnap.data() as Partial<StudentProfile>, user.uid)
      } else {
        const fallbackSnap = await getDocs(
          query(collection(db, 'students'), where('uid', '==', user.uid), limit(1))
        )
        if (!fallbackSnap.empty) {
          loadedStudent = normalizeStudent(fallbackSnap.docs[0].data() as Partial<StudentProfile>, user.uid)
        }
      }
      setStudentProfile(loadedStudent)
      if (loadedStudent) {
        setCvUrl(loadedStudent.cvUrl || '')
        setTranscriptUrl(loadedStudent.transcriptUrl || '')
      }
    } catch (err) {
      console.error('Failed to load application prerequisites:', err)
      setLoadError('Failed to load position and profile data from Firebase. Please try again.')
    } finally {
      setPageLoading(false)
    }
  }, [positionId, user])

  useEffect(() => {
    loadApplyData()
  }, [loadApplyData])

  const matchResult =
    studentProfile && position ? computeMatch(studentProfile, position) : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !position || !studentProfile || !statement.trim()) return

    setLoading(true)
    setSubmitError('')
    const applicationId = `app-${Date.now()}`
    const nowIso = new Date().toISOString()

    const computed = matchResult ?? computeMatch(studentProfile, position)

    const newApp: Application = {
      id: applicationId,
      studentId: user.uid,
      studentName: studentProfile.fullName || user.displayName || user.email || 'Student',
      studentPhotoURL: user.photoURL || studentProfile.photoURL || '',
      professorId: position.professorId,
      positionId: position.id,
      positionTitle: position.title,
      professorName: position.professorName,
      university: position.university,
      matchScore: computed.score,
      matchBreakdown: computed.breakdown,
      matchExplanation: computed.explanation,
      cvUrl: cvUrl.trim(),
      transcriptUrl: transcriptUrl.trim(),
      applicationStatement: statement.trim(),
      status: 'submitted',
      statusHistory: [
        {
          status: 'submitted',
          changedAt: nowIso,
          note: 'Application submitted online',
        },
      ],
      submittedAt: nowIso,
      updatedAt: nowIso,
    }

    try {
      await setDoc(doc(db, 'applications', applicationId), {
        ...newApp,
        createdAt: serverTimestamp(),
      })
      setSubmitted(true)
    } catch (err) {
      console.error('Failed to submit application to Firestore:', err)
      setSubmitError('Failed to submit your application to Firebase. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading research position details…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Unable to Load Position</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
              Back to Directory
            </Button>
            <Button size="sm" onClick={loadApplyData} className="flex items-center gap-1.5">
              <RefreshCw size={14} />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Position Not Found</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            The research position you are trying to apply for does not exist or is no longer available.
          </p>
          <Button size="sm" onClick={() => navigate('/search')}>
            Browse Faculty Directory
          </Button>
        </div>
      </div>
    )
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Student Profile Required</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            A student profile document in Firestore is required before submitting applications.
          </p>
          <Button size="sm" onClick={() => navigate('/dashboard/student')}>
            Back to Dashboard
          </Button>
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
              {matchResult && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-400">Match Compatibility:</span>
                  <span className="font-bold text-blue-600">{matchResult.score}% Match Overlap</span>
                </div>
              )}
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

        {submitError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{submitError}</span>
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
                <span>{position.university}{position.department ? ` (${position.department})` : ''}</span>
              </p>
            </div>

            {matchResult && (
              <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                <MatchScoreBadge score={matchResult.score} size="md" />
                <span className="text-[11px] text-slate-500">Compatibility Score</span>
              </div>
            )}
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
              <span className="font-semibold text-slate-800">{position.stipend || 'Not specified'}</span>
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
                  placeholder="Describe your academic background, thesis work, and why you wish to join this group..."
                  rows={6}
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Documents Attached */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Application Document Links
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      CV / Resume URL
                    </label>
                    <input
                      type="url"
                      value={cvUrl}
                      onChange={(e) => setCvUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transcript URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={transcriptUrl}
                      onChange={(e) => setTranscriptUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Ready for faculty review upon submission
                </span>

                <Button
                  type="submit"
                  size="md"
                  disabled={loading || !statement.trim()}
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
          {matchResult && (
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
          )}

        </div>

      </div>
    </div>
  )
}
