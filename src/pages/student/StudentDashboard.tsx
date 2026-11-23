import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { 
  User, BookOpen, Search, Heart, FileText, TrendingUp, 
  ChevronRight, Star, GraduationCap, CheckCircle2, ArrowUpRight,
  Sparkles, MapPin, AlertCircle, DollarSign
} from 'lucide-react'
import { db } from '@/lib/firebase'
import {
  buildDirectoryEntryFromStudent,
  fetchPublicProfessorsSafely,
  loadSplitStudentProfile,
  syncUserDirectoryEntry,
} from '@/lib/messaging'
import {
  PROFESSOR_FUNDING_STATUS_LABELS,
  getFundingStatusBadgeStyle,
  normalizeProfessorFundingInfo,
} from '@/lib/professorFunding'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import type { Application } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'
import { STATUS_LABELS, calculateProfileCompleteness } from '@/utils/helpers'
import { computeMatch } from '@/lib/matching'

type ProfessorWithPositions = ProfessorProfile & {
  positions: Position[]
  matchScore?: number
  matchExplanation?: string
  positionsError?: 'permission_denied' | 'network_error' | null
}

interface SavedProfessorItem {
  uid: string
  username: string
  fullName: string
  academicTitle: string
  university: string
  country: string
  photoURL?: string
  researchAreas: string[]
  matchScore: number
  openPositionsCount: number
  isRecruiting: boolean
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

function createInitialStudentProfile(uid = '', email = '', displayName = '', photoURL?: string): StudentProfile {
  const now = new Date().toISOString()
  const base: StudentProfile = {
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
  return {
    ...base,
    profileCompleteness: calculateProfileCompleteness(base),
  }
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile>(() =>
    createInitialStudentProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [applications, setApplications] = useState<Application[]>([])
  const [recommendedProfessors, setRecommendedProfessors] = useState<ProfessorWithPositions[]>([])
  const [recommendationsError, setRecommendationsError] = useState<'permission_denied' | 'network_error' | null>(null)
  const [savedProfessors, setSavedProfessors] = useState<SavedProfessorItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const [studentRes, appsRes, profsRes] = await Promise.allSettled([
          loadSplitStudentProfile(user.uid),
          getDocs(query(collection(db, 'applications'), where('studentId', '==', user.uid))),
          fetchPublicProfessorsSafely(12),
        ])

        if (!isMounted) return

        let loadedProfile = createInitialStudentProfile(
          user.uid,
          user.email || '',
          user.displayName || '',
          user.photoURL || undefined
        )
        if (studentRes.status === 'fulfilled' && studentRes.value.exists) {
          const data = studentRes.value.data
          const merged: StudentProfile = {
            ...loadedProfile,
            ...data,
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
            savedProfessorIds: Array.isArray(data.savedProfessorIds) ? data.savedProfessorIds : [],
          }
          loadedProfile = {
            ...merged,
            profileCompleteness: calculateProfileCompleteness(merged),
          }
          syncUserDirectoryEntry(buildDirectoryEntryFromStudent(loadedProfile)).catch(() => {
            // Non-blocking directory backfill
          })
        }
        setProfile(loadedProfile)

        if (appsRes.status === 'fulfilled') {
          const loadedApps: Application[] = appsRes.value.docs
            .map((d) => ({
              ...(d.data() as Application),
              id: d.id,
            }))
            .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
          setApplications(loadedApps)
        }

        let hasPermissionDenied = false
        let hasNetworkError = false

        if (profsRes.status === 'rejected') {
          const errObj = profsRes.reason as { code?: string; message?: string } | null
          const msg = `${errObj?.code || ''} ${errObj?.message || ''}`.toLowerCase()
          if (msg.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('missing or insufficient permissions')) {
            hasPermissionDenied = true
          } else {
            hasNetworkError = true
          }
        }

        const profDocs = profsRes.status === 'fulfilled' ? profsRes.value : []
        const profResults: ProfessorWithPositions[] = []
        for (const profData of profDocs) {
          const profUid = profData.uid
          let positions: Position[] = []
          let posErrType: 'permission_denied' | 'network_error' | null = null
          try {
            const posSnap = await getDocs(
              query(collection(db, 'positions'), where('professorId', '==', profUid), where('isOpen', '==', true))
            )
            positions = posSnap.docs.map((d) => ({ ...(d.data() as Position), id: d.id }))
          } catch (posErr: unknown) {
            console.error('Failed to query positions for recommended professor:', profUid, posErr)
            const errObj = posErr as { code?: string; message?: string } | null
            const msg = `${errObj?.code || ''} ${errObj?.message || ''}`.toLowerCase()
            if (msg.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('missing or insufficient permissions')) {
              posErrType = 'permission_denied'
              hasPermissionDenied = true
            } else {
              posErrType = 'network_error'
              hasNetworkError = true
            }
            positions = []
          }
          let bestScore: number | undefined
          let bestExplanation: string | undefined
          for (const pos of positions) {
            const m = computeMatch(loadedProfile, pos)
            if (bestScore === undefined || m.score > bestScore) {
              bestScore = m.score
              bestExplanation = m.explanation
            }
          }
          profResults.push({
            ...profData,
            uid: profUid,
            researchAreas: Array.isArray(profData.researchAreas) ? profData.researchAreas : [],
            researchInterests: Array.isArray(profData.researchInterests) ? profData.researchInterests : [],
            fundingInfo: normalizeProfessorFundingInfo(profData.fundingInfo),
            positions,
            matchScore: bestScore,
            matchExplanation: bestExplanation,
            positionsError: posErrType,
          })
        }

        profResults.sort((a, b) => {
          const scoreA = a.matchScore ?? -1
          const scoreB = b.matchScore ?? -1
          if (scoreA !== scoreB) return scoreB - scoreA
          return b.positions.length - a.positions.length
        })
        if (isMounted) {
          setRecommendedProfessors(profResults.slice(0, 4))
          setRecommendationsError(hasPermissionDenied ? 'permission_denied' : hasNetworkError ? 'network_error' : null)
        }

        const savedIds = loadedProfile.savedProfessorIds || []
        if (savedIds.length > 0) {
          const resolvedSaved: SavedProfessorItem[] = []
          for (const savedId of savedIds) {
            const existing = profResults.find((p) => p.uid === savedId)
            if (existing) {
              resolvedSaved.push({
                uid: existing.uid,
                username: existing.username || existing.uid,
                fullName: existing.fullName,
                academicTitle: existing.academicTitle,
                university: existing.university,
                country: existing.country,
                photoURL: existing.photoURL,
                researchAreas: existing.researchAreas,
                matchScore: existing.matchScore ?? 0,
                openPositionsCount: existing.positions.length,
                isRecruiting: Boolean(existing.isRecruiting),
              })
            } else {
              try {
                const sSnap = await getDoc(doc(db, 'professors', savedId))
                if (sSnap.exists()) {
                  const sData = sSnap.data() as ProfessorProfile
                  const sUid = sData.uid || sSnap.id
                  const sPosSnap = await getDocs(
                    query(collection(db, 'positions'), where('professorId', '==', sUid), where('isOpen', '==', true))
                  )
                  const sPositions = sPosSnap.docs.map((d) => ({ ...(d.data() as Position), id: d.id }))
                  const sScore = sPositions.length
                    ? Math.max(...sPositions.map((pos) => computeMatch(loadedProfile, pos).score))
                    : 0
                  resolvedSaved.push({
                    uid: sUid,
                    username: sData.username || sUid,
                    fullName: sData.fullName,
                    academicTitle: sData.academicTitle,
                    university: sData.university,
                    country: sData.country,
                    photoURL: sData.photoURL,
                    researchAreas: Array.isArray(sData.researchAreas) ? sData.researchAreas : [],
                    matchScore: sScore,
                    openPositionsCount: sPositions.length,
                    isRecruiting: Boolean(sData.isRecruiting),
                  })
                }
              } catch {
                // Skip if a saved legacy professor document is not yet migrated for public read
              }
            }
          }
          if (isMounted) setSavedProfessors(resolvedSaved)
        } else if (isMounted) {
          setSavedProfessors([])
        }
      } catch (err) {
        console.error('Failed to load student dashboard data from Firestore:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDashboardData()
    return () => {
      isMounted = false
    }
  }, [user])

  const completeness = profile?.profileCompleteness ?? 0

  const completenessItems = [
    { label: 'Basic & Contact Information', done: !!(profile?.fullName && profile?.email) },
    { label: 'Academic Background & GPA', done: !!(profile?.university && profile?.gpa > 0) },
    { label: 'Research Interests & Topics', done: (profile?.researchInterests?.length ?? 0) > 0 },
    { label: 'Technical Skills & Frameworks', done: (profile?.programmingLanguages?.length ?? 0) > 0 },
    { label: 'Language / Exam Scores (IELTS/GRE)', done: (profile?.languageScores?.length ?? 0) > 0 },
    { label: 'Curriculum Vitae (CV) Attached', done: !!profile?.cvUrl },
  ]

  const interviewCount = applications.filter((a) => a.status === 'interview').length
  const firstName = profile?.fullName
    ? profile.fullName.split(' ')[0]
    : user?.displayName
    ? user.displayName.split(' ')[0]
    : 'Researcher'

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading your student dashboard…</p>
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles size={13} className="text-blue-600" />
                <span>Student Research Portal</span>
              </div>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-slate-500 text-sm max-w-xl">
              Track your faculty applications, explore AI-matched research opportunities, and manage your academic profile.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/saved')}
              className="flex items-center gap-2"
              id="dashboard-saved-btn"
            >
              <Heart size={15} className="text-rose-500" />
              <span>Saved ({savedProfessors.length})</span>
            </Button>
            <Button
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 shadow-xs"
              id="dashboard-search-btn"
            >
              <Search size={15} />
              <span>Find Professors</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{applications.length}</p>
              <p className="text-xs font-medium text-slate-500">Active Applications</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{interviewCount}</p>
              <p className="text-xs font-medium text-slate-500">Scheduled Interviews</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
              <Heart size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{savedProfessors.length}</p>
              <p className="text-xs font-medium text-slate-500">Bookmarked Faculty</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* My Applications Section */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">My Applications</h2>
                    <p className="text-xs text-slate-500">Recent submissions and review progress</p>
                  </div>
                </div>

                <Link
                  to="/applications"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1 group"
                >
                  <span>View All</span>
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="space-y-3.5">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => navigate(`/applications/${app.id}`)}
                    className="p-4 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 hover:bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    id={`app-card-${app.id}`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                        <GraduationCap size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {app.positionTitle}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {app.professorName} · <span className="font-medium text-slate-700">{app.university}</span>
                        </p>
                        {app.matchExplanation && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                            "{app.matchExplanation}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <MatchChip score={app.matchScore} />
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${STATUS_BADGE_STYLES[app.status] || 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABELS[app.status] || app.status}
                      </span>
                    </div>
                  </div>
                ))}

                {applications.length === 0 && (
                  <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <FileText size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                    <p className="text-sm font-semibold text-slate-800">No applications submitted yet</p>
                    <p className="text-xs text-slate-500 mt-1">Explore open positions matching your research background</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/search')}>
                      Browse Faculty Openings
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Professors Section */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Star size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">Recommended Professors</h2>
                    <p className="text-xs text-slate-500">Highest compatibility with your academic focus</p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/search')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  id="see-all-recs-btn"
                >
                  Explore All
                </Button>
              </div>

              {recommendationsError === 'permission_denied' ? (
                <div className="text-center py-6 px-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center justify-center gap-2 font-bold text-sm text-amber-800">
                    <AlertCircle size={18} className="text-amber-600" />
                    <span>Access Restricted</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Faculty recommendation queries or position listings were restricted by Firestore permissions.
                  </p>
                </div>
              ) : recommendationsError === 'network_error' ? (
                <div className="text-center py-6 px-4 bg-red-50 rounded-2xl border border-red-200 text-red-900 space-y-1">
                  <div className="flex items-center justify-center gap-2 font-bold text-sm text-red-800">
                    <AlertCircle size={18} className="text-red-600" />
                    <span>Network Error</span>
                  </div>
                  <p className="text-xs text-red-700">
                    Unable to load recommendations due to a network connection issue.
                  </p>
                </div>
              ) : recommendedProfessors.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Star size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-slate-800">No recommended professors available yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Faculty opportunities will appear here as professors publish openings.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendedProfessors.map((prof) => {
                    const score = prof.matchScore
                    return (
                      <div
                        key={prof.uid}
                        onClick={() => navigate(`/professor/${prof.username || prof.uid}`)}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
                        id={`rec-card-${prof.uid}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar src={prof.photoURL} name={prof.fullName} size="md" />
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                  {prof.fullName}
                                </h3>
                                <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                  <MapPin size={11} className="text-slate-400 shrink-0" />
                                  {prof.university}
                                </p>
                              </div>
                            </div>
                            {score !== undefined && <MatchChip score={score} />}
                          </div>

                          <div className="flex flex-wrap gap-1.5 my-3">
                            {prof.fundingInfo?.fundingStatus && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getFundingStatusBadgeStyle(
                                  prof.fundingInfo.fundingStatus
                                )}`}
                              >
                                <DollarSign size={10} />
                                <span>
                                  {PROFESSOR_FUNDING_STATUS_LABELS[prof.fundingInfo.fundingStatus]}
                                </span>
                              </span>
                            )}
                            {prof.researchAreas.slice(0, 2).map((area) => (
                              <span
                                key={area}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                          {prof.matchExplanation && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 italic mb-2">
                              "{prof.matchExplanation}"
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:text-blue-700">
                          <span>
                            {prof.positions.length > 0
                              ? `${prof.positions.length} open position${prof.positions.length !== 1 ? 's' : ''}`
                              : 'View Lab & Openings'}
                          </span>
                          <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column / Sidebar */}
          <div className="space-y-8">
            
            {/* Student Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
              <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
                <Avatar src={profile.photoURL} name={profile.fullName} size="lg" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-base truncate">{profile.fullName}</h3>
                  <p className="text-xs text-slate-500 truncate">{profile.degree} in {profile.major}</p>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">{profile.university}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    GPA: <strong className="text-slate-800">{profile.gpa > 0 ? `${profile.gpa} / ${profile.gpaScale || 4.0}` : 'Not set'}</strong>
                  </p>
                </div>
              </div>

              {/* Completeness Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-600">Profile Completeness</span>
                  <span className="font-bold text-blue-700">{completeness}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2 mb-6">
                {completenessItems.map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <CheckCircle2
                      size={14}
                      className={done ? 'text-emerald-500 fill-emerald-50 shrink-0' : 'text-slate-300 shrink-0'}
                    />
                    <span className={done ? 'text-slate-700 font-medium' : 'text-slate-400'}>{label}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                fullWidth
                size="sm"
                onClick={() => navigate('/profile/student')}
                className="flex items-center justify-center gap-2"
                id="edit-profile-btn"
              >
                <User size={14} />
                <span>Edit Academic Profile</span>
              </Button>
            </div>

            {/* Research Focus & Keywords */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
              <h3 className="font-display text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-blue-600" />
                <span>My Research Focus</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {profile.researchInterests.map((interest) => (
                  <span
                    key={interest}
                    className="px-2.5 py-1 rounded-lg bg-blue-50/70 border border-blue-200/70 text-blue-800 text-xs font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>

              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Technical Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {profile.programmingLanguages.concat(profile.frameworks.slice(0, 3)).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Saved Faculty Quick Peek */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Heart size={15} className="text-rose-500" />
                  <span>Saved Faculty</span>
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {savedProfessors.length} saved
                </span>
              </div>

              <div className="space-y-3">
                {savedProfessors.slice(0, 3).map((p) => (
                  <div
                    key={p.uid}
                    onClick={() => navigate(`/professor/${p.username}`)}
                    className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer flex items-center gap-3"
                    id={`saved-prof-${p.uid}`}
                  >
                    <Avatar src={p.photoURL} name={p.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{p.fullName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.university}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {p.matchScore}%
                    </span>
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                fullWidth
                size="sm"
                onClick={() => navigate('/saved')}
                className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                id="view-saved-btn"
              >
                View all saved professors →
              </Button>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
