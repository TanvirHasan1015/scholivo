import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore'
import {
  Users, Briefcase, Plus, CheckCircle2, Clock,
  Sparkles, Building,
  GraduationCap, ArrowUpRight, ChevronRight, Filter,
  Settings, Award, ShieldCheck, AlertCircle, FileText,
  X, ExternalLink, BookOpen, Code
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { Position } from '@/types/position.types'
import type { Application, ApplicationStatus } from '@/types/application.types'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
import type { MatchResult } from '@/types/match.types'
import { computeMatch } from '@/lib/matching'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip, MatchBreakdownPanel } from '@/components/matching/MatchScore'
import { STATUS_LABELS, formatRelativeDate } from '@/utils/helpers'

type ProfessorWithPositions = ProfessorProfile & { positions: Position[] }

const STATUS_PILL_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-700/10 text-rose-700 border-rose-200',
}

export interface CandidateMatch {
  student: StudentProfile
  matchResult: MatchResult
}

function createInitialProfessorProfile(uid = '', email = '', displayName = '', photoURL?: string): ProfessorWithPositions {
  const now = new Date().toISOString()
  return {
    uid,
    fullName: displayName || 'Faculty Member',
    username: email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '',
    email,
    academicTitle: 'Associate Professor',
    country: 'South Korea',
    photoURL,
    university: '',
    department: '',
    faculty: '',
    biography: '',
    researchAreas: [],
    researchInterests: [],
    currentProjects: [],
    publications: [],
    verificationStatus: 'pending',
    verificationDocuments: [],
    accountStatus: 'active',
    isRecruiting: true,
    recruitingStatus: 'actively_recruiting',
    createdAt: now,
    updatedAt: now,
    positions: [],
  }
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfessorWithPositions>(() =>
    createInitialProfessorProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [positions, setPositions] = useState<Position[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [verifiedStudents, setVerifiedStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [isRecruiting, setIsRecruiting] = useState<boolean>(true)

  // Ensure only positions owned by the logged-in professor are selectable
  const currentProfessorId = user?.uid || profile?.uid || ''
  const ownedPositions = useMemo(() => {
    if (!currentProfessorId) return []
    return positions.filter(
      (p) => Boolean(p.professorId) && p.professorId === currentProfessorId
    )
  }, [positions, currentProfessorId])

  // Opportunity selection state (derived fallback to professor's first active position)
  const [selectedPositionId, setSelectedPositionId] = useState<string>('')

  const selectedPosition = useMemo(() => {
    if (ownedPositions.length === 0) return null
    if (selectedPositionId) {
      const explicit = ownedPositions.find((p) => p.id === selectedPositionId)
      if (explicit) return explicit
    }
    const active = ownedPositions.filter((p) => p.isOpen)
    return active[0] || ownedPositions[0] || null
  }, [ownedPositions, selectedPositionId])

  // Opportunity-specific applicants (strictly isolated to selected position)
  const positionApplications = useMemo(() => {
    if (!selectedPosition) return []
    return applications.filter((a) => a.positionId === selectedPosition.id)
  }, [selectedPosition, applications])

  const filteredApplications = useMemo(() => {
    if (selectedStatusFilter === 'all') return positionApplications
    return positionApplications.filter((a) => a.status === selectedStatusFilter)
  }, [selectedStatusFilter, positionApplications])

  // Opportunity-specific recommended non-applicants (recalculated whenever selectedPosition, applications, or verifiedStudents change)
  const recommendedCandidates: CandidateMatch[] = useMemo(() => {
    if (!selectedPosition) return []

    const appliedStudentIds = new Set(
      applications
        .filter((a) => a.positionId === selectedPosition.id)
        .map((a) => a.studentId)
    )

    const eligible = verifiedStudents.filter((student) => {
      if (!student || !student.uid) return false
      if (appliedStudentIds.has(student.uid)) return false
      return (
        student.verificationStatus === 'verified' &&
        (student.accountStatus || 'active') === 'active'
      )
    })

    const scored: CandidateMatch[] = eligible.map((student) => ({
      student,
      matchResult: computeMatch(student, selectedPosition),
    }))

    scored.sort((a, b) => b.matchResult.score - a.matchResult.score)
    return scored
  }, [selectedPosition, applications, verifiedStudents])

  // Candidate Profile & Match Analysis Modal State
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const handleSelectPosition = (positionId: string) => {
    setSelectedPositionId(positionId)
    setSelectedCandidateId(null)
  }

  // Only resolve modal candidate if they are currently present in recommendedCandidates
  const activeCandidateMatch = useMemo(() => {
    if (!selectedCandidateId || !selectedPosition) return null
    const found = recommendedCandidates.find((c) => c.student.uid === selectedCandidateId)
    if (!found) return null
    const freshMatchResult = computeMatch(found.student, selectedPosition)
    return {
      student: found.student,
      matchResult: freshMatchResult,
    }
  }, [selectedCandidateId, selectedPosition, recommendedCandidates])

  // Handle Escape key and body scroll lock for modal
  useEffect(() => {
    if (!activeCandidateMatch) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCandidateId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [activeCandidateMatch])

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const [profSnap, posSnap, appSnap, studentsSnap] = await Promise.all([
          getDoc(doc(db, 'professors', user.uid)),
          getDocs(query(collection(db, 'positions'), where('professorId', '==', user.uid))),
          getDocs(query(collection(db, 'applications'), where('professorId', '==', user.uid))),
          getDocs(query(collection(db, 'students'), where('verificationStatus', '==', 'verified'))),
        ])

        if (!isMounted) return

        const posList: Position[] = posSnap.docs.map(
          (d) => ({ ...(d.data() as Position), id: d.id })
        )
        setPositions(posList)

        if (profSnap.exists()) {
          const profData = profSnap.data() as ProfessorProfile
          const mergedProf: ProfessorWithPositions = {
            ...createInitialProfessorProfile(
              user.uid,
              user.email || '',
              user.displayName || '',
              user.photoURL || undefined
            ),
            ...profData,
            uid: profData.uid || user.uid,
            researchAreas: Array.isArray(profData.researchAreas) ? profData.researchAreas : [],
            researchInterests: Array.isArray(profData.researchInterests) ? profData.researchInterests : [],
            currentProjects: Array.isArray(profData.currentProjects) ? profData.currentProjects : [],
            publications: Array.isArray(profData.publications) ? profData.publications : [],
            verificationStatus: profData.verificationStatus || 'pending',
            positions: posList,
          }
          setProfile(mergedProf)
          setIsRecruiting(
            typeof profData.isRecruiting === 'boolean'
              ? profData.isRecruiting
              : (profData.recruitingStatus || 'actively_recruiting') === 'actively_recruiting'
          )
        } else {
          setProfile((prev) => ({ ...prev, positions: posList }))
        }

        const appList: Application[] = appSnap.docs.map(
          (d) => ({ ...(d.data() as Application), id: d.id })
        )
        setApplications(appList)

        const studentList: StudentProfile[] = studentsSnap.docs.map((d) => {
          const data = d.data() as StudentProfile
          return {
            ...data,
            uid: data.uid || d.id,
            researchInterests: Array.isArray(data.researchInterests) ? data.researchInterests : [],
            researchAreas: Array.isArray(data.researchAreas) ? data.researchAreas : [],
            researchExperience: Array.isArray(data.researchExperience) ? data.researchExperience : [],
            projects: Array.isArray(data.projects) ? data.projects : [],
            publications: Array.isArray(data.publications) ? data.publications : [],
            programmingLanguages: Array.isArray(data.programmingLanguages) ? data.programmingLanguages : [],
            frameworks: Array.isArray(data.frameworks) ? data.frameworks : [],
            technicalSkills: Array.isArray(data.technicalSkills) ? data.technicalSkills : [],
            researchTools: Array.isArray(data.researchTools) ? data.researchTools : [],
            languageScores: Array.isArray(data.languageScores) ? data.languageScores : [],
          }
        })
        setVerifiedStudents(studentList)
      } catch (err) {
        console.error('Error fetching professor dashboard data from Firestore:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  const toggleRecruiting = async () => {
    if (!user) return
    const next = !isRecruiting
    const nextRecruitingStatus = next ? 'actively_recruiting' : 'not_recruiting'
    const now = new Date().toISOString()

    setIsRecruiting(next)
    setProfile((prev) => ({
      ...prev,
      isRecruiting: next,
      recruitingStatus: nextRecruitingStatus,
      updatedAt: now,
    }))

    try {
      await updateDoc(doc(db, 'professors', user.uid), {
        isRecruiting: next,
        recruitingStatus: nextRecruitingStatus,
        updatedAt: now,
      })
    } catch (err) {
      console.error('Failed to update recruiting status in Firestore:', err)
    }
  }

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    if (!user) return
    if ((profile.verificationStatus || 'pending') !== 'verified') {
      alert('Faculty verification required to change candidate application stages.')
      return
    }

    const targetApp = applications.find((a) => a.id === appId)
    if (!targetApp || targetApp.professorId !== user.uid || targetApp.status === newStatus) return

    const previousApp = targetApp
    const now = new Date().toISOString()
    const nextHistory = [
      ...(targetApp.statusHistory || []),
      { status: newStatus, changedAt: now, note: `Updated to ${STATUS_LABELS[newStatus]}` },
    ]

    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              status: newStatus,
              statusHistory: nextHistory,
              updatedAt: now,
            }
          : app
      )
    )

    try {
      await updateDoc(doc(db, 'applications', appId), {
        status: newStatus,
        statusHistory: nextHistory,
        updatedAt: now,
      })
    } catch (err) {
      console.error('Failed to update application status in Firestore:', err)
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? previousApp : app))
      )
    }
  }

  const stats = {
    totalPositions: ownedPositions.filter((p) => p.isOpen).length,
    totalApplications: applications.length,
    underReview: applications.filter((a) => a.status === 'under_review').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    interview: applications.filter((a) => a.status === 'interview').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
  }

  const statusFilterTabs = [
    { id: 'all', label: 'All Applicants', count: positionApplications.length },
    { id: 'submitted', label: 'New Submissions', count: positionApplications.filter((a) => a.status === 'submitted').length },
    { id: 'under_review', label: 'Under Review', count: positionApplications.filter((a) => a.status === 'under_review').length },
    { id: 'shortlisted', label: 'Shortlisted', count: positionApplications.filter((a) => a.status === 'shortlisted').length },
    { id: 'interview', label: 'Interviews', count: positionApplications.filter((a) => a.status === 'interview').length },
    { id: 'accepted', label: 'Offered / Accepted', count: positionApplications.filter((a) => a.status === 'accepted').length },
  ]

  const isVerifiedProfessor = (profile.verificationStatus || 'pending') === 'verified'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading your faculty dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles size={13} className="text-blue-600" />
                <span>Faculty Research Portal</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${isVerifiedProfessor
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                <ShieldCheck size={13} className={isVerifiedProfessor ? 'text-emerald-600' : 'text-amber-600'} />
                <span>{isVerifiedProfessor ? 'Verified Lab' : `Affiliation: ${profile.verificationStatus || 'pending'}`}</span>
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {profile.fullName} 👋
            </h1>
            <p className="text-slate-500 text-sm max-w-xl">
              {profile.academicTitle} at <strong className="text-slate-700">{profile.university}</strong> ({profile.department}). Manage open recruitment calls and evaluate prospective researchers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleRecruiting}
              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${isRecruiting
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              id="toggle-recruiting-btn"
            >
              <span className={`w-2 h-2 rounded-full ${isRecruiting ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isRecruiting ? 'Recruiting Active' : 'Recruiting Paused'}</span>
            </button>

            <Button
              variant="outline"
              onClick={() => navigate('/profile/professor/edit')}
              className="flex items-center gap-1.5 text-xs font-semibold"
              id="edit-profile-shortcut-btn"
            >
              <Settings size={14} />
              <span>Edit Profile</span>
            </Button>

            <Button
              onClick={() => navigate('/positions/manage')}
              className="flex items-center gap-1.5 shadow-xs"
              id="post-position-btn"
            >
              <Plus size={15} />
              <span>Post Position</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Briefcase size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{stats.totalPositions}</p>
              <p className="text-xs font-medium text-slate-500">Active Openings</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Users size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{stats.totalApplications}</p>
              <p className="text-xs font-medium text-slate-500">Total Applicants</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{stats.underReview}</p>
              <p className="text-xs font-medium text-slate-500">Under Review</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{stats.shortlisted + stats.interview}</p>
              <p className="text-xs font-medium text-slate-500">Shortlisted / Interviews</p>
            </div>
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column (2 Cols): Opportunity Selection, Position Applicants & Recommended Students */}
          <div className="lg:col-span-2 space-y-8">

            {ownedPositions.length === 0 ? (
              /* Empty state: No active research opportunities */
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center" id="empty-no-positions">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto mb-4">
                  <Briefcase size={32} />
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 mb-2">No Active Research Opportunities</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  You do not have any active research positions listed. Create and publish a research opportunity to start reviewing candidate submissions and discovering automated student matches.
                </p>
                <Button
                  onClick={() => navigate('/positions/manage')}
                  className="inline-flex items-center gap-2 text-xs font-semibold"
                  id="create-first-position-btn"
                >
                  <Plus size={16} />
                  <span>Create Research Opportunity</span>
                </Button>
              </div>
            ) : !selectedPosition ? (
              /* Empty state: No selected opportunity */
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center" id="empty-no-selected-position">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mx-auto mb-4">
                  <Filter size={32} />
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 mb-2">No Opportunity Selected</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  Please choose a research opportunity from your lab listings to view direct applicants and personalized candidate recommendations.
                </p>
                {ownedPositions.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => handleSelectPosition(ownedPositions[0].id)}
                    className="text-xs font-semibold"
                    id="select-first-opportunity-btn"
                  >
                    Select {ownedPositions[0].title}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Opportunity Switcher Card */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6" id="target-opportunity-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          Target Opportunity
                        </span>
                        {selectedPosition.isOpen ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Accepting Applications
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            Position Closed
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1 truncate">
                        {selectedPosition.title}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {selectedPosition.degreeType.replace('_', ' ')} • {selectedPosition.researchArea} • {selectedPosition.stipend || 'Fully Funded'}
                      </p>
                    </div>

                    {ownedPositions.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                        <label htmlFor="position-switcher-select" className="text-xs font-semibold text-slate-600 shrink-0">
                          Select Position:
                        </label>
                        <select
                          id="position-switcher-select"
                          value={selectedPosition.id}
                          onChange={(e) => handleSelectPosition(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white outline-none cursor-pointer shadow-2xs transition-all max-w-[220px] truncate"
                        >
                          {ownedPositions.map((pos) => (
                            <option key={pos.id} value={pos.id}>
                              {pos.title} ({pos.isOpen ? 'Open' : 'Closed'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 1: Position Applicants */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7" id="section-position-applicants">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Users size={18} />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-bold text-slate-900">Position Applicants</h2>
                        <p className="text-xs text-slate-500">
                          Candidates who have formally applied for {selectedPosition.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {positionApplications.length} {positionApplications.length === 1 ? 'Applicant' : 'Applicants'}
                      </span>
                    </div>
                  </div>

                  {/* Status Filter Tab Pills */}
                  <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl mb-6">
                    {statusFilterTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedStatusFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${selectedStatusFilter === tab.id
                            ? 'bg-white text-blue-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                          }`}
                        id={`filter-tab-${tab.id}`}
                      >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${selectedStatusFilter === tab.id ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Pending Faculty Verification Alert */}
                  {!isVerifiedProfessor && (
                    <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 mb-6">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-950">Faculty Verification Pending</p>
                        <p className="mt-0.5 text-amber-800 leading-relaxed">
                          Candidate dossier evaluation and application stage transitions are locked until institutional affiliation is approved by an administrator. You may still update your research profile and prepare draft opportunities.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Applications List & Empty States */}
                  <div className="space-y-4">
                    {positionApplications.length === 0 ? (
                      /* Empty state: No applicants for the selected opportunity */
                      <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-no-position-applicants">
                        <Users size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                        <p className="text-sm font-semibold text-slate-800">No applicants for this opportunity yet</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          No students have submitted applications for "{selectedPosition.title}" yet. You can discover top matching verified researchers in the Recommended Students section below.
                        </p>
                      </div>
                    ) : filteredApplications.length === 0 ? (
                      /* Empty state: No applicants in selected status filter */
                      <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-status-filter-applicants">
                        <FileText size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                        <p className="text-sm font-semibold text-slate-800">
                          No applicants in "{STATUS_LABELS[selectedStatusFilter as ApplicationStatus] || selectedStatusFilter}"
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Select "All Applicants" to inspect all candidate submissions for this position.</p>
                        <button
                          onClick={() => setSelectedStatusFilter('all')}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                        >
                          View all {positionApplications.length} applicants
                        </button>
                      </div>
                    ) : (
                      filteredApplications.map((app) => (
                        <div
                          key={app.id}
                          className="p-5 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all bg-slate-50/40 hover:bg-white flex flex-col justify-between gap-4 group"
                          id={`applicant-card-${app.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <Avatar src={app.studentPhotoURL} name={app.studentName} size="md" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                    {app.studentName}
                                  </h3>
                                  <MatchChip score={app.matchScore} />
                                </div>
                                <p className="text-xs font-semibold text-blue-700 mt-0.5">
                                  {app.positionTitle}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Applied {formatRelativeDate(app.submittedAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_PILL_STYLES[app.status]}`}>
                                {STATUS_LABELS[app.status]}
                              </span>
                            </div>
                          </div>

                          {/* Statement Preview */}
                          {app.applicationStatement && (
                            <p className="text-xs text-slate-600 line-clamp-2 bg-white/80 p-3 rounded-xl border border-slate-200/60 italic">
                              "{app.applicationStatement}"
                            </p>
                          )}

                          {/* Action Bar */}
                          <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-500 mr-1">Move Stage:</span>
                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                                disabled={!isVerifiedProfessor}
                                title={!isVerifiedProfessor ? 'Faculty verification required to change stage' : undefined}
                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-blue-600 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                                id={`change-status-${app.id}`}
                              >
                                <option value="submitted">Submitted</option>
                                <option value="under_review">Under Review</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="interview">Interview</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/applications/${app.id}`)}
                              className="flex items-center gap-1 text-xs font-semibold"
                              id={`view-dossier-${app.id}`}
                            >
                              <span>Review Full Dossier</span>
                              <ArrowUpRight size={13} />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 2: Recommended Students */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7" id="section-recommended-students">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-display text-lg font-bold text-slate-900">Recommended Students</h2>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Verified researchers matching {selectedPosition.title} who have not applied
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {recommendedCandidates.length} Recommendations
                      </span>
                    </div>
                  </div>

                  {/* Recommended Candidates List & Empty State */}
                  <div className="space-y-4">
                    {recommendedCandidates.length === 0 ? (
                      /* Empty state: No eligible recommended students */
                      <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200" id="empty-no-recommended-students">
                        <Users size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                        <p className="text-sm font-semibold text-slate-800">No eligible recommended students</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                          All verified students in the network have either already submitted an application for "{selectedPosition.title}" or do not meet active verification eligibility criteria.
                        </p>
                      </div>
                    ) : (
                      recommendedCandidates.map(({ student, matchResult }) => {
                        // Extract two or three matched keyword tags
                        const matchedKeywordsList = matchResult.matchedKeywords || []
                        const displayKeywords = matchedKeywordsList.length >= 2
                          ? matchedKeywordsList.slice(0, 3)
                          : Array.from(new Set([...matchedKeywordsList, ...(student.technicalSkills || []), ...(student.programmingLanguages || [])])).slice(0, 3)

                        // Research specialty or research-interest summary
                        const specialtySummary = (student.researchInterests && student.researchInterests.length > 0)
                          ? student.researchInterests.join(', ')
                          : (student.researchAreas?.join(', ') || 'Interdisciplinary AI & Computer Science')

                        return (
                          <div
                            key={student.uid}
                            className="p-5 rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all bg-slate-50/40 hover:bg-white flex flex-col justify-between gap-4 group"
                            id={`rec-candidate-${student.uid}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex items-start gap-3.5 min-w-0">
                                <Avatar src={student.photoURL} name={student.fullName} size="md" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                      {student.fullName}
                                    </h3>
                                    <MatchChip score={matchResult.score} />
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <ShieldCheck size={11} className="text-emerald-600" />
                                      <span>Verified Student</span>
                                    </span>
                                  </div>
                                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                    {student.university} • {student.major} ({student.degree})
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    GPA: {student.gpa} / {student.gpaScale} • Expected {student.expectedGraduation}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                                  Non-Applicant
                                </span>
                              </div>
                            </div>

                            {/* Research Specialty or Interest Summary */}
                            <div className="text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                              <p>
                                <span className="font-semibold text-slate-900">Research Specialty: </span>
                                <span>{specialtySummary}</span>
                              </p>
                              {matchResult.explanation && (
                                <p className="mt-1 text-slate-600">
                                  <span className="font-semibold text-slate-800">Match Fit: </span>
                                  {matchResult.explanation}
                                </p>
                              )}
                            </div>

                            {/* Two or three matched keyword tags */}
                            {displayKeywords.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-slate-400 mr-1">Matched Keywords:</span>
                                {displayKeywords.map((kw) => (
                                  <span
                                    key={kw}
                                    className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Action Bar & Score Breakdown */}
                            <div className="pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                <span>Research: <strong className="text-slate-700">{matchResult.breakdown.researchInterests}%</strong></span>
                                <span>Skills: <strong className="text-slate-700">{matchResult.breakdown.skills}%</strong></span>
                                <span>Language: <strong className="text-slate-700">{matchResult.breakdown.language}%</strong></span>
                                <span>Major: <strong className="text-slate-700">{matchResult.breakdown.major}%</strong></span>
                                <span>Experience: <strong className="text-slate-700">{matchResult.breakdown.experience}%</strong></span>
                              </div>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedCandidateId(student.uid)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-emerald-700"
                                id={`view-rec-candidate-${student.uid}`}
                              >
                                <span>View Profile & Match Analysis</span>
                                <ArrowUpRight size={13} />
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Right Column: Active Opportunities & Quick Links */}
          <div className="space-y-8">

            {/* Active Research Positions */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-blue-600" />
                  <h3 className="font-display text-sm font-bold text-slate-900">Lab Positions</h3>
                </div>
                <Link
                  to="/positions/manage"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  <span>Manage</span>
                  <ChevronRight size={13} />
                </Link>
              </div>

              <div className="space-y-3.5">
                {ownedPositions.map((pos) => {
                  const isSelected = pos.id === selectedPosition?.id
                  const applicantCount = applications.filter((a) => a.positionId === pos.id).length
                  return (
                    <div
                      key={pos.id}
                      onClick={() => handleSelectPosition(pos.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${isSelected
                          ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                          : 'border-slate-200/80 hover:border-blue-300 hover:bg-slate-50/60'
                        }`}
                      id={`lab-pos-${pos.id}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {pos.degreeType.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                              Selected
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pos.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {pos.isOpen ? 'Accepting' : 'Closed'}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {pos.title}
                      </h4>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{applicantCount} applicant{applicantCount !== 1 ? 's' : ''}</span>
                        <span className="text-blue-600 font-semibold group-hover:underline">Inspect Candidates →</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                variant="outline"
                fullWidth
                size="sm"
                onClick={() => navigate('/positions/manage')}
                className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold"
                id="post-new-opening-btn"
              >
                <Plus size={14} />
                <span>Create Research Opportunity</span>
              </Button>
            </div>

            {/* Quick Profile Overview */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <Avatar src={profile.photoURL} name={profile.fullName} size="md" />
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{profile.fullName}</h4>
                  <p className="text-xs text-slate-500 truncate">{profile.academicTitle}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Building size={14} className="text-slate-400 shrink-0" />
                  <span>{profile.university} ({profile.department})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={14} className="text-slate-400 shrink-0" />
                  <span>{profile.publications?.length || 0} Peer-reviewed Publications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400 shrink-0" />
                  <span>{profile.labName || 'Research Laboratory'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => navigate('/profile/professor/edit')}
                  className="text-xs font-semibold"
                  id="dashboard-edit-faculty-btn"
                >
                  Edit Profile & Lab Info
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => navigate(`/professor/${profile.username || user?.uid || ''}`)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  id="dashboard-view-public-btn"
                >
                  View Public Profile →
                </Button>
              </div>
            </div>

          </div>

        </div>

        {/* Candidate Profile & Match Analysis Modal */}
        {activeCandidateMatch && selectedPosition && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
            onClick={() => setSelectedCandidateId(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-modal-title"
            id="candidate-profile-modal-backdrop"
          >
            <div
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              id="candidate-profile-modal-content"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0 bg-white">
                <div className="flex items-start gap-4 min-w-0">
                  <Avatar
                    src={activeCandidateMatch.student.photoURL}
                    name={activeCandidateMatch.student.fullName}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        id="candidate-modal-title"
                        className="font-display text-xl sm:text-2xl font-bold text-slate-900 truncate"
                      >
                        {activeCandidateMatch.student.fullName}
                      </h2>
                      <MatchChip score={activeCandidateMatch.matchResult.score} />
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck size={12} className="text-emerald-600" />
                        <span>Verified Student</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">
                      {activeCandidateMatch.student.university} • {activeCandidateMatch.student.major} ({activeCandidateMatch.student.degree})
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        Recommended Candidate • Non-Applicant
                      </span>
                      <span className="text-xs text-slate-500">
                        Evaluated for: <strong className="text-slate-800">{selectedPosition.title}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCandidateId(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                  aria-label="Close modal"
                  id="close-candidate-modal-btn"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-5 sm:p-7 overflow-y-auto space-y-7 flex-1">
                {/* 1. Opportunity Compatibility & Breakdown */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
                    <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-600" />
                      <span>Opportunity Compatibility Analysis</span>
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0 self-start sm:self-center">
                      Target: {selectedPosition.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Compatibility computed against <strong>{selectedPosition.title}</strong> ({selectedPosition.degreeType.replace('_', ' ')} • {selectedPosition.researchArea}) based on verified profile attributes.
                  </p>
                  {/* Reused MatchBreakdownPanel */}
                  <MatchBreakdownPanel result={activeCandidateMatch.matchResult} />
                </div>

                {/* 2. Personal & Academic Information */}
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                    <GraduationCap size={16} className="text-blue-600" />
                    <span>Personal & Academic Information</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-400 block font-medium mb-0.5">Institution & Department</span>
                      <span className="font-bold text-slate-900">{activeCandidateMatch.student.university}</span>
                      <p className="text-slate-600 mt-0.5">{activeCandidateMatch.student.department}</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-400 block font-medium mb-0.5">Major & Degree</span>
                      <span className="font-bold text-slate-900">{activeCandidateMatch.student.major}</span>
                      <p className="text-slate-600 mt-0.5">{activeCandidateMatch.student.degree} Degree Program</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-400 block font-medium mb-0.5">Academic Performance</span>
                      <span className="font-bold text-slate-900">GPA: {activeCandidateMatch.student.gpa} / {activeCandidateMatch.student.gpaScale}</span>
                      {activeCandidateMatch.student.currentSemester && (
                        <p className="text-slate-600 mt-0.5">Semester: {activeCandidateMatch.student.currentSemester}</p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-slate-400 block font-medium mb-0.5">Timeline & Location</span>
                      <span className="font-bold text-slate-900">Expected {activeCandidateMatch.student.expectedGraduation}</span>
                      <p className="text-slate-600 mt-0.5">{activeCandidateMatch.student.country}</p>
                    </div>
                  </div>

                  {/* Academic Biography */}
                  {activeCandidateMatch.student.bio && (
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                      <h4 className="text-xs font-bold text-slate-800 mb-1">Academic & Professional Biography</h4>
                      <p className="text-xs text-slate-600 leading-relaxed italic">
                        "{activeCandidateMatch.student.bio}"
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Research Focus & Interests */}
                {((activeCandidateMatch.student.researchAreas && activeCandidateMatch.student.researchAreas.length > 0) ||
                  (activeCandidateMatch.student.researchInterests && activeCandidateMatch.student.researchInterests.length > 0)) && (
                    <div className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                        <BookOpen size={16} className="text-blue-600" />
                        <span>Research Focus & Interests</span>
                      </h3>

                      {activeCandidateMatch.student.researchAreas && activeCandidateMatch.student.researchAreas.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                            Core Research Areas
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeCandidateMatch.student.researchAreas.map((area) => (
                              <span
                                key={area}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/70"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeCandidateMatch.student.researchInterests && activeCandidateMatch.student.researchInterests.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                            Specialized Research Topics
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {activeCandidateMatch.student.researchInterests.map((interest) => (
                              <span
                                key={interest}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* 4. Technical Skills & Tools */}
                {((activeCandidateMatch.student.programmingLanguages && activeCandidateMatch.student.programmingLanguages.length > 0) ||
                  (activeCandidateMatch.student.frameworks && activeCandidateMatch.student.frameworks.length > 0) ||
                  (activeCandidateMatch.student.technicalSkills && activeCandidateMatch.student.technicalSkills.length > 0) ||
                  (activeCandidateMatch.student.researchTools && activeCandidateMatch.student.researchTools.length > 0)) && (
                    <div className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Code size={16} className="text-indigo-600" />
                        <span>Technical Skills & Research Tools</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeCandidateMatch.student.programmingLanguages && activeCandidateMatch.student.programmingLanguages.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              Programming Languages
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeCandidateMatch.student.programmingLanguages.map((lang) => (
                                <span
                                  key={lang}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs"
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeCandidateMatch.student.frameworks && activeCandidateMatch.student.frameworks.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              Frameworks & Libraries
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeCandidateMatch.student.frameworks.map((fw) => (
                                <span
                                  key={fw}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs"
                                >
                                  {fw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeCandidateMatch.student.technicalSkills && activeCandidateMatch.student.technicalSkills.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              Technical Methodologies
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeCandidateMatch.student.technicalSkills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeCandidateMatch.student.researchTools && activeCandidateMatch.student.researchTools.length > 0 && (
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              Research Tools & Platforms
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeCandidateMatch.student.researchTools.map((tool) => (
                                <span
                                  key={tool}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-2xs"
                                >
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* 5. Previous Research Experience */}
                {activeCandidateMatch.student.researchExperience && activeCandidateMatch.student.researchExperience.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                      <GraduationCap size={16} className="text-emerald-600" />
                      <span>Research Experience</span>
                    </h3>

                    <div className="space-y-3">
                      {activeCandidateMatch.student.researchExperience.map((exp) => (
                        <div key={exp.id || exp.title} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <h4 className="text-xs font-bold text-slate-900">{exp.title}</h4>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate || 'Completed'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-blue-700">{exp.role} • {exp.organization}</p>
                          {exp.description && (
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Selected Projects */}
                {activeCandidateMatch.student.projects && activeCandidateMatch.student.projects.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Briefcase size={16} className="text-purple-600" />
                      <span>Selected Projects</span>
                    </h3>

                    <div className="space-y-3">
                      {activeCandidateMatch.student.projects.map((proj) => (
                        <div key={proj.id || proj.title} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="text-xs font-bold text-slate-900">{proj.title}</h4>
                            {proj.url && (
                              <a
                                href={proj.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold"
                              >
                                <span>Project Link</span>
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{proj.description}</p>
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2.5">
                              {proj.technologies.map((tech) => (
                                <span
                                  key={tech}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. Publications & Papers */}
                {activeCandidateMatch.student.publications && activeCandidateMatch.student.publications.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Award size={16} className="text-amber-600" />
                      <span>Publications & Papers</span>
                    </h3>

                    <div className="space-y-2.5">
                      {activeCandidateMatch.student.publications.map((pub) => (
                        <div key={pub.id || pub.title} className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/70">
                          <h4 className="text-xs font-bold text-slate-900">{pub.title}</h4>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {pub.authors?.join(', ')} • {pub.conference || pub.journal} ({pub.year})
                          </p>
                          {pub.doi && (
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">DOI: {pub.doi}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. Language Proficiency */}
                {activeCandidateMatch.student.languageScores && activeCandidateMatch.student.languageScores.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                      Language Proficiency
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {activeCandidateMatch.student.languageScores.map((lang, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                        >
                          <span className="text-slate-500 mr-1">{lang.type}:</span>
                          <span>{lang.score}</span>
                          {lang.label && <span className="text-slate-400 font-normal ml-1">({lang.label})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>
                    Verified student in the Scholivo talent network. Non-applicant preview.
                  </span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCandidateId(null)}
                  className="text-xs font-semibold shrink-0"
                  id="close-candidate-modal-footer-btn"
                >
                  Close Profile
                </Button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
