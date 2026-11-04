import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { 
  User, BookOpen, Search, Heart, FileText, TrendingUp, 
  Star, GraduationCap, CheckCircle2, ArrowUpRight,
  Sparkles, MapPin, AlertCircle, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import type { Application } from '@/types/application.types'
import type { ProfessorWithPositions, SavedProfessorItem } from '@/lib/demoData'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'
import { STATUS_LABELS, calculateProfileCompleteness } from '@/utils/helpers'
import { computeMatch } from '@/lib/matching'

const STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

function normalizeStudent(raw: Partial<StudentProfile>, fallbackUid: string): StudentProfile {
  const normalized: StudentProfile = {
    uid: raw.uid || fallbackUid,
    fullName: raw.fullName ?? '',
    username: raw.username ?? '',
    email: raw.email ?? '',
    universityEmail: raw.universityEmail,
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
    bio: raw.bio ?? '',
    accountStatus: raw.accountStatus ?? 'active',
    profileCompleteness: 0,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  }
  normalized.profileCompleteness = calculateProfileCompleteness(normalized)
  return normalized
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [recommendedProfessors, setRecommendedProfessors] = useState<ProfessorWithPositions[]>([])
  const [savedProfessors] = useState<SavedProfessorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')

    try {
      // 1. Load Student Profile
      let loadedProfile: StudentProfile | null = null
      const directSnap = await getDoc(doc(db, 'students', user.uid))
      if (directSnap.exists()) {
        loadedProfile = normalizeStudent(directSnap.data() as Partial<StudentProfile>, user.uid)
      } else {
        const fallbackSnap = await getDocs(
          query(collection(db, 'students'), where('uid', '==', user.uid), limit(1))
        )
        if (!fallbackSnap.empty) {
          loadedProfile = normalizeStudent(fallbackSnap.docs[0].data() as Partial<StudentProfile>, user.uid)
        }
      }
      setProfile(loadedProfile)

      // 2. Load Student Applications
      const appSnap = await getDocs(
        query(collection(db, 'applications'), where('studentId', '==', user.uid))
      )
      const appList: Application[] = []
      appSnap.forEach((d) => appList.push({ id: d.id, ...d.data() } as Application))
      setApplications(appList)

      // 3. Load Recommended Professors from Firestore
      const profSnap = await getDocs(query(collection(db, 'professors'), limit(8)))
      const profList: ProfessorWithPositions[] = []
      for (const d of profSnap.docs) {
        const rawProf = d.data() as Partial<ProfessorProfile>
        const profUid = rawProf.uid || d.id
        const posSnap = await getDocs(
          query(
            collection(db, 'positions'),
            where('professorId', '==', profUid),
            where('isOpen', '==', true)
          )
        )
        const positions: Position[] = []
        posSnap.forEach((p) => {
          const rawPos = p.data() as Partial<Position>
          positions.push({
            ...rawPos,
            id: p.id,
            researchTopics: Array.isArray(rawPos.researchTopics) ? rawPos.researchTopics : [],
            requiredSkills: Array.isArray(rawPos.requiredSkills) ? rawPos.requiredSkills : [],
            preferredSkills: Array.isArray(rawPos.preferredSkills) ? rawPos.preferredSkills : [],
            languageRequirements: Array.isArray(rawPos.languageRequirements) ? rawPos.languageRequirements : [],
            researchArea: rawPos.researchArea ?? '',
          } as Position)
        })

        const matchScore =
          loadedProfile && positions.length > 0
            ? Math.max(...positions.map((pos) => computeMatch(loadedProfile!, pos).score))
            : undefined

        profList.push({
          ...(rawProf as ProfessorProfile),
          uid: profUid,
          fullName: rawProf.fullName ?? 'Professor',
          username: rawProf.username ?? profUid,
          university: rawProf.university ?? '',
          researchAreas: Array.isArray(rawProf.researchAreas) ? rawProf.researchAreas : [],
          researchInterests: Array.isArray(rawProf.researchInterests) ? rawProf.researchInterests : [],
          positions,
          matchScore,
        })
      }

      profList.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      setRecommendedProfessors(profList.slice(0, 4))
    } catch (err) {
      console.error('Error loading student dashboard:', err)
      setLoadError('Failed to load dashboard data from Firebase. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const completeness = profile?.profileCompleteness ?? 0

  const completenessItems = [
    { label: 'Basic & Contact Information', done: !!profile?.fullName && !!profile?.email },
    { label: 'Academic Background & GPA', done: !!profile?.university },
    { label: 'Research Interests & Topics', done: (profile?.researchInterests?.length ?? 0) > 0 },
    { label: 'Technical Skills & Frameworks', done: (profile?.programmingLanguages?.length ?? 0) > 0 },
    { label: 'Language / Exam Scores (IELTS/GRE)', done: (profile?.languageScores?.length ?? 0) > 0 },
    { label: 'CV & Academic Transcript Uploaded', done: !!profile?.cvUrl },
  ]

  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length
  const firstName = (profile?.fullName || user?.displayName || 'Student').split(' ')[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {loadError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{loadError}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadDashboardData} className="flex items-center gap-1.5 self-start sm:self-auto">
              <RefreshCw size={13} />
              <span>Retry</span>
            </Button>
          </div>
        )}

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
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 font-display">{shortlistedCount}</p>
              <p className="text-xs font-medium text-slate-500">Shortlisted Interviews</p>
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
                      {typeof app.matchScore === 'number' && <MatchChip score={app.matchScore} />}
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
                    <p className="text-xs text-slate-500 mt-1">Explore positions matching your research background</p>
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
                    <p className="text-xs text-slate-500">Faculty profiles from the Scholivo research directory</p>
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

              {recommendedProfessors.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Search size={32} className="mx-auto text-slate-400 mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-slate-800">No professor profiles found yet</p>
                  <p className="text-xs text-slate-500 mt-1">Once professors publish their profiles and openings, they will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendedProfessors.map((prof) => (
                    <div
                      key={prof.uid}
                      onClick={() => navigate(`/professor/${prof.username}`)}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
                      id={`rec-card-${prof.uid}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar src={prof.photoURL} name={prof.fullName} size="md" />
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {prof.fullName}
                              </h3>
                              <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                {prof.university || 'University not listed'}
                              </p>
                            </div>
                          </div>
                          {typeof prof.matchScore === 'number' && <MatchChip score={prof.matchScore} />}
                        </div>

                        <div className="flex flex-wrap gap-1.5 my-3">
                          {(prof.researchAreas || []).slice(0, 2).map((area) => (
                            <span
                              key={area}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:text-blue-700">
                        <span>View Lab & Openings</span>
                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column / Sidebar */}
          <div className="space-y-8">
            
            {/* Student Profile Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
              {profile ? (
                <>
                  <div className="flex items-center gap-3.5 mb-5 pb-5 border-b border-slate-100">
                    <Avatar src={profile.photoURL} name={profile.fullName || user?.displayName || 'Student'} size="lg" />
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-base truncate">{profile.fullName || user?.displayName}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {profile.degree}{profile.major ? ` in ${profile.major}` : ''}
                      </p>
                      <p className="text-xs font-semibold text-blue-600 mt-0.5">{profile.university || 'University not set'}</p>
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
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <User size={22} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Academic Profile Not Found</h3>
                  <p className="text-xs text-slate-500">
                    No student profile record was found for your account in Firestore.
                  </p>
                </div>
              )}
            </div>

            {/* Research Focus & Keywords */}
            {profile && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6">
                <h3 className="font-display text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-600" />
                  <span>My Research Focus</span>
                </h3>
                {profile.researchInterests.length > 0 ? (
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
                ) : (
                  <p className="text-xs text-slate-400 italic mb-4">No research interests added yet.</p>
                )}

                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Technical Skills</h4>
                {profile.programmingLanguages.length > 0 || profile.frameworks.length > 0 ? (
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
                ) : (
                  <p className="text-xs text-slate-400 italic">No technical skills added yet.</p>
                )}
              </div>
            )}

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

              {savedProfessors.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No saved professors yet.</p>
              ) : (
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
              )}

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
