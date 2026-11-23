import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import {
  ArrowLeft, FileText, GraduationCap, Calendar, Search,
  ArrowUpRight, Clock, AlertCircle, Video
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { formatInterviewDateTime } from '@/lib/notifications'
import { useAuth } from '@/context/AuthContext'
import type { Application, ApplicationStatus } from '@/types/application.types'
import { Button } from '@/components/common/Button'
import { MatchChip } from '@/components/matching/MatchScore'
import { STATUS_LABELS, formatDate } from '@/utils/helpers'

const STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  interview: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function StudentApplications() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    let isMounted = true

    async function loadStudentApplications() {
      if (!user) {
        if (isMounted) {
          setApplications([])
          setLoading(false)
        }
        return
      }

      if (isMounted) setLoading(true)

      try {
        const snap = await getDocs(
          query(collection(db, 'applications'), where('studentId', '==', user.uid))
        )
        if (!isMounted) return

        const list: Application[] = snap.docs
          .map((d) => ({
            ...(d.data() as Application),
            id: d.id,
          }))
          .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))

        setApplications(list)
        setErrorMsg(null)
      } catch (err) {
        console.error('Failed to load student applications from Firestore:', err)
        if (isMounted) {
          setErrorMsg('Failed to load your applications from the server. Please refresh and try again.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadStudentApplications()
    return () => {
      isMounted = false
    }
  }, [user, authLoading])

  const filteredApplications = useMemo(() => {
    if (statusFilter === 'all') return applications
    return applications.filter((a) => a.status === statusFilter)
  }, [applications, statusFilter])

  const filterTabs = [
    { id: 'all', label: 'All Applications', count: applications.length },
    { id: 'submitted', label: 'Submitted', count: applications.filter((a) => a.status === 'submitted').length },
    { id: 'under_review', label: 'Under Review', count: applications.filter((a) => a.status === 'under_review').length },
    { id: 'interview', label: 'Interview', count: applications.filter((a) => a.status === 'interview').length },
    { id: 'accepted', label: 'Accepted', count: applications.filter((a) => a.status === 'accepted').length },
    { id: 'rejected', label: 'Rejected', count: applications.filter((a) => a.status === 'rejected').length },
  ]

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading your submitted applications…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate('/dashboard/student')}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
                  My Applications
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {applications.length} Total
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Track the live review status and evaluation updates for your submitted lab applications
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/search')}
            className="flex items-center gap-2 shadow-xs"
            id="browse-openings-btn"
          >
            <Search size={15} />
            <span>Find More Openings</span>
          </Button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Status Filter Pills */}
        {applications.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                id={`student-app-tab-${tab.id}`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-2xs max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600">
              <FileText size={32} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-display">No applications submitted yet</h2>
            <p className="text-sm text-slate-500">
              Explore faculty research opportunities and submit an application to track your admissions progress here.
            </p>
            <Button onClick={() => navigate('/search')} className="mt-2">
              Browse Faculty Directory
            </Button>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-2xs space-y-3">
            <p className="text-sm font-semibold text-slate-800">
              No applications in "{STATUS_LABELS[statusFilter as ApplicationStatus] || statusFilter}"
            </p>
            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
              Show All Applications
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => {
              const latestEvent =
                app.statusHistory && app.statusHistory.length > 0
                  ? app.statusHistory[app.statusHistory.length - 1]
                  : null
              return (
                <div
                  key={app.id}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer space-y-4 group"
                  id={`student-application-card-${app.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <GraduationCap size={22} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {app.positionTitle}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          <strong className="font-semibold text-slate-800">{app.professorName}</strong> • {app.university}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            Submitted {formatDate(app.submittedAt)}
                          </span>
                          {app.updatedAt && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              Updated {formatDate(app.updatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-start">
                      <MatchChip score={app.matchScore} />
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                          STATUS_BADGE_STYLES[app.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {STATUS_LABELS[app.status] || app.status}
                      </span>
                    </div>
                  </div>

                  {app.interviewAt && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-purple-50/90 border border-purple-200 text-xs text-purple-900 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Calendar size={13} className="text-purple-600 shrink-0" />
                        <span>Interview Scheduled: {formatInterviewDateTime(app.interviewAt)}</span>
                      </span>
                      {app.interviewMeetingUrl && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-white px-2.5 py-0.5 rounded-full border border-purple-200">
                          <Video size={11} />
                          <span>Zoom Meeting Ready</span>
                        </span>
                      )}
                    </div>
                  )}

                  {latestEvent?.note && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-center justify-between gap-2">
                      <span className="italic truncate">Latest update: "{latestEvent.note}"</span>
                      <span className="text-blue-600 font-semibold shrink-0 flex items-center gap-1">
                        <span>View Dossier</span>
                        <ArrowUpRight size={13} />
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

