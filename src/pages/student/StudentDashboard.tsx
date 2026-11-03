import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'
import { 
  User, BookOpen, Search, Heart, FileText, Bell, TrendingUp, 
  ChevronRight, Star, GraduationCap, Award, CheckCircle2, ArrowUpRight,
  Sparkles, Clock, Compass, MapPin
} from 'lucide-react'
import { db, isDemoMode } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile } from '@/types/user.types'
import type { Application } from '@/types/application.types'
import { 
  DEMO_STUDENT_PROFILE, 
  DEMO_APPLICATIONS, 
  DEMO_SAVED_PROFESSORS, 
  DEMO_PROFESSORS, 
  type SavedProfessorItem 
} from '@/lib/demoData'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'
import { STATUS_LABELS } from '@/utils/helpers'

const STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

import { computeMatch } from '@/lib/matching'
import { calculateProfileCompleteness } from '@/utils/helpers'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile>(() => {
    const local = localStorage.getItem('rm_demo_student_profile')
    if (local) {
      try {
        const p = JSON.parse(local)
        return { ...p, profileCompleteness: calculateProfileCompleteness(p) }
      } catch {
        // fallback
      }
    }
    return { ...DEMO_STUDENT_PROFILE, profileCompleteness: calculateProfileCompleteness(DEMO_STUDENT_PROFILE) }
  })
  const loadSyncedApplications = (): Application[] => {
    let apps = [...DEMO_APPLICATIONS]
    const savedAppsStr = localStorage.getItem('rm_demo_applications')
    if (savedAppsStr) {
      try {
        const profApps: Application[] = JSON.parse(savedAppsStr)
        apps = apps.map((studentApp) => {
          const match = profApps.find(
            (pa) =>
              pa.id === studentApp.id ||
              (studentApp.id === 'app1' && pa.id === 'app-101') ||
              pa.positionId === studentApp.positionId
          )
          if (match) {
            return {
              ...studentApp,
              status: match.status,
              statusHistory: match.statusHistory && match.statusHistory.length > 0 ? match.statusHistory : studentApp.statusHistory,
              updatedAt: match.updatedAt || studentApp.updatedAt,
            }
          }
          return studentApp
        })
      } catch {
        // fallback to default apps
      }
    }
    return apps
  }

  const [applications, setApplications] = useState<Application[]>(loadSyncedApplications)
  const [savedProfessors, setSavedProfessors] = useState<SavedProfessorItem[]>(() => {
    const localSaved = localStorage.getItem('rm_demo_saved_professors')
    if (localSaved) {
      try {
        return JSON.parse(localSaved)
      } catch {
        // fallback
      }
    }
    return DEMO_SAVED_PROFESSORS
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemoMode) {
      const local = localStorage.getItem('rm_demo_student_profile')
      const p = local ? JSON.parse(local) : { ...DEMO_STUDENT_PROFILE }
      setProfile({ ...p, profileCompleteness: calculateProfileCompleteness(p) })
      setApplications(loadSyncedApplications())

      const localSaved = localStorage.getItem('rm_demo_saved_professors')
      if (localSaved) {
        try {
          setSavedProfessors(JSON.parse(localSaved))
        } catch {
          setSavedProfessors(DEMO_SAVED_PROFESSORS)
        }
      } else {
        setSavedProfessors(DEMO_SAVED_PROFESSORS)
      }
      setLoading(false)
      return
    }

    if (user) {
      getDocs(query(collection(db, 'students'), where('uid', '==', user.uid), limit(1)))
        .then((snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data() as StudentProfile
            setProfile({ ...data, profileCompleteness: calculateProfileCompleteness(data) })
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  const completeness = profile?.profileCompleteness ?? 92

  const completenessItems = [
    { label: 'Basic & Contact Information', done: true },
    { label: 'Academic Background & GPA', done: !!profile?.university },
    { label: 'Research Interests & Topics', done: (profile?.researchInterests?.length ?? 0) > 0 },
    { label: 'Technical Skills & Frameworks', done: (profile?.programmingLanguages?.length ?? 0) > 0 },
    { label: 'Language / Exam Scores (IELTS/GRE)', done: (profile?.languageScores?.length ?? 0) > 0 },
    { label: 'CV & Academic Transcript Uploaded', done: !!profile?.cvUrl },
  ]

  const shortlistedCount = applications.filter((a) => a.status === 'shortlisted').length

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
              Welcome back, {user?.displayName ? user.displayName.split(' ')[0] : 'Alex'} 👋
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DEMO_PROFESSORS.slice(0, 4).map((prof) => {
                  const score = prof.positions?.length && profile
                    ? Math.max(...prof.positions.map((pos) => computeMatch(profile, pos).score))
                    : 75
                  return (
                    <div
                      key={prof.uid}
                      onClick={() => navigate(`/professor/${prof.username}`)}
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
                          <MatchChip score={score} />
                        </div>

                        <div className="flex flex-wrap gap-1.5 my-3">
                          {prof.researchAreas.slice(0, 2).map((area) => (
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
                  )
                })}
              </div>
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
