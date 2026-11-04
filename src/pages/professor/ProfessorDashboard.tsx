import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore'
import { 
  Users, Briefcase, Plus, CheckCircle2, Clock, 
  Sparkles, Building, 
  ArrowUpRight, ChevronRight, 
  Settings, Award, FileText, AlertCircle, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import type { Application, ApplicationStatus } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'
import { STATUS_LABELS, formatRelativeDate } from '@/utils/helpers'

const STATUS_PILL_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfessorProfile | null>(null)
  const [profDocId, setProfDocId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')
  const [isRecruiting, setIsRecruiting] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string>('')
  const [actionError, setActionError] = useState<string>('')

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')

    try {
      // 1. Load Professor Profile
      let loadedProfile: ProfessorProfile | null = null
      let resolvedDocId: string | null = null
      const directSnap = await getDoc(doc(db, 'professors', user.uid))
      if (directSnap.exists()) {
        resolvedDocId = directSnap.id
        loadedProfile = { ...(directSnap.data() as ProfessorProfile), uid: user.uid }
      } else {
        const fallbackSnap = await getDocs(
          query(collection(db, 'professors'), where('uid', '==', user.uid), limit(1))
        )
        if (!fallbackSnap.empty) {
          resolvedDocId = fallbackSnap.docs[0].id
          loadedProfile = { ...(fallbackSnap.docs[0].data() as ProfessorProfile), uid: user.uid }
        }
      }

      setProfile(loadedProfile)
      setProfDocId(resolvedDocId)
      setIsRecruiting(Boolean(loadedProfile?.isRecruiting))

      // 2. Load Professor's Positions
      const posQ = query(collection(db, 'positions'), where('professorId', '==', user.uid))
      const posSnap = await getDocs(posQ)
      const posList: Position[] = []
      posSnap.forEach((d) => posList.push({ id: d.id, ...d.data() } as Position))
      setPositions(posList)

      // 3. Load Professor's Incoming Applications
      const appQ = query(collection(db, 'applications'), where('professorId', '==', user.uid))
      const appSnap = await getDocs(appQ)
      const appList: Application[] = []
      appSnap.forEach((d) => appList.push({ id: d.id, ...d.data() } as Application))
      setApplications(appList)
    } catch (err) {
      console.error('Error fetching professor data:', err)
      setLoadError('Failed to load faculty dashboard data from Firebase. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleRecruiting = async () => {
    if (!user || !profile || !profDocId) return
    setActionError('')
    const next = !isRecruiting
    const nextStatus = next ? 'actively_recruiting' : 'not_recruiting'
    const nowIso = new Date().toISOString()

    try {
      await updateDoc(doc(db, 'professors', profDocId), {
        isRecruiting: next,
        recruitingStatus: nextStatus,
        updatedAt: nowIso,
      })
      setIsRecruiting(next)
      setProfile({
        ...profile,
        isRecruiting: next,
        recruitingStatus: nextStatus,
        updatedAt: nowIso,
      })
    } catch (err) {
      console.error('Failed to update recruiting status:', err)
      setActionError('Failed to update recruiting status in Firestore. Please try again.')
    }
  }

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    if (!user) return
    const targetApp = applications.find((a) => a.id === appId)
    if (!targetApp || targetApp.professorId !== user.uid) {
      setActionError('You are not authorized to modify this application.')
      return
    }

    setActionError('')
    const nowIso = new Date().toISOString()
    const updatedHistory = [
      ...(targetApp.statusHistory || []),
      { status: newStatus, changedAt: nowIso, note: `Updated to ${STATUS_LABELS[newStatus]}` },
    ]

    try {
      await updateDoc(doc(db, 'applications', appId), {
        status: newStatus,
        statusHistory: updatedHistory,
        updatedAt: nowIso,
      })
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId
            ? { ...app, status: newStatus, statusHistory: updatedHistory, updatedAt: nowIso }
            : app
        )
      )
    } catch (err) {
      console.error('Failed to update application status:', err)
      setActionError('Failed to update application status in Firestore. Please try again.')
    }
  }

  const filteredApplications = selectedStatusFilter === 'all'
    ? applications
    : applications.filter((a) => a.status === selectedStatusFilter)

  const stats = {
    totalPositions: positions.filter((p) => p.isOpen).length,
    totalApplications: applications.length,
    underReview: applications.filter((a) => a.status === 'under_review').length,
    shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    interview: applications.filter((a) => a.status === 'interview').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
  }

  const statusFilterTabs = [
    { id: 'all', label: 'All Candidates', count: applications.length },
    { id: 'submitted', label: 'New Submissions', count: applications.filter((a) => a.status === 'submitted').length },
    { id: 'under_review', label: 'Under Review', count: stats.underReview },
    { id: 'shortlisted', label: 'Shortlisted', count: stats.shortlisted },
    { id: 'interview', label: 'Interviews', count: stats.interview },
    { id: 'accepted', label: 'Offered / Accepted', count: stats.accepted },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading your faculty dashboard…</p>
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
            <Button size="sm" variant="outline" onClick={loadData} className="flex items-center gap-1.5 self-start sm:self-auto">
              <RefreshCw size={13} />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        
        {/* Top Header Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                <Sparkles size={13} className="text-blue-600" />
                <span>Faculty Research Portal</span>
              </div>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {profile?.fullName || user?.displayName || 'Professor'} 👋
            </h1>
            {profile ? (
              <p className="text-slate-500 text-sm max-w-xl">
                {profile.academicTitle || 'Faculty'} at <strong className="text-slate-700">{profile.university || 'University not set'}</strong>
                {profile.department ? ` (${profile.department})` : ''}. Manage open recruitment calls and evaluate prospective researchers.
              </p>
            ) : (
              <p className="text-slate-500 text-sm max-w-xl">
                Manage open recruitment calls and evaluate prospective researchers.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profile && (
              <button
                onClick={toggleRecruiting}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                  isRecruiting
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
                id="toggle-recruiting-btn"
              >
                <span className={`w-2 h-2 rounded-full ${isRecruiting ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{isRecruiting ? 'Recruiting Active' : 'Recruiting Paused'}</span>
              </button>
            )}

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
          
          {/* Left Column (2 Cols): Applications Management */}
          <div className="lg:col-span-2 space-y-8">
            
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">Incoming Applications</h2>
                    <p className="text-xs text-slate-500">Review student dossiers, compatibility scores, and update stages</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {filteredApplications.length} Displayed
                  </span>
                </div>
              </div>

              {/* Status Filter Tab Pills */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl mb-6">
                {statusFilterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedStatusFilter === tab.id
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                    id={`filter-tab-${tab.id}`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      selectedStatusFilter === tab.id ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Applications List */}
              <div className="space-y-4">
                {filteredApplications.map((app) => (
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
                            {typeof app.matchScore === 'number' && <MatchChip score={app.matchScore} />}
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
                          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-blue-600 outline-none cursor-pointer"
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
                ))}

                {filteredApplications.length === 0 && (
                  <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <FileText size={36} className="mx-auto text-slate-400 mb-2 opacity-60" />
                    <p className="text-sm font-semibold text-slate-800">No applications in this category</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {applications.length === 0
                        ? 'You have not received any student applications yet.'
                        : 'Select "All Candidates" to inspect your complete applicant queue.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

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

              {positions.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No positions posted yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {positions.map((pos) => {
                    const applicantCount = applications.filter((a) => a.positionId === pos.id).length
                    return (
                      <div
                        key={pos.id}
                        onClick={() => navigate('/positions/manage')}
                        className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:bg-slate-50/60 transition-all cursor-pointer group"
                        id={`lab-pos-${pos.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {pos.degreeType.replace('_', ' ')}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            pos.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {pos.isOpen ? 'Accepting' : 'Closed'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {pos.title}
                        </h4>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{applicantCount} applicant{applicantCount !== 1 ? 's' : ''}</span>
                          <span className="text-blue-600 font-semibold group-hover:underline">Edit opening →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
              {profile ? (
                <>
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <Avatar src={profile.photoURL} name={profile.fullName || user?.displayName || 'Professor'} size="md" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{profile.fullName || user?.displayName}</h4>
                      <p className="text-xs text-slate-500 truncate">{profile.academicTitle}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building size={14} className="text-slate-400 shrink-0" />
                      <span>{profile.university || 'University not set'}{profile.department ? ` (${profile.department})` : ''}</span>
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

                    {profile.username && (
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => navigate(`/professor/${profile.username}`)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        id="dashboard-view-public-btn"
                      >
                        View Public Profile →
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                    <Building size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Faculty Profile Not Found</h4>
                  <p className="text-xs text-slate-500">
                    No professor profile document was found in Firestore for your account.
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
