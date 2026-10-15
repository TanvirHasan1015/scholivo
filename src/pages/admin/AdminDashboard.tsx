import { useState, useEffect } from 'react'
import {
  Check, X, Shield, Users, FileText, ExternalLink, AlertCircle, Clock,
  Search, Filter, CheckCircle2, XCircle, AlertTriangle, UserCheck,
  Building, GraduationCap, ArrowUpRight, Ban, RefreshCw, Eye, Sparkles
} from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { Input, Select } from '@/components/common/Input'
import { formatDate } from '@/utils/helpers'
import {
  DEMO_VERIFICATION_REQUESTS,
  DEMO_SYSTEM_USERS,
  DEMO_VERIFICATION_AUDIT_LOG,
  type VerificationRequestItem,
  type SystemUserItem
} from '@/lib/demoData'
import type {
  AffiliationVerificationStatus,
  AccountStatus,
  VerificationAuditLog,
  UserRole
} from '@/types/user.types'

const VERIFICATION_BADGES: Record<AffiliationVerificationStatus, { label: string; style: string }> = {
  verified: { label: 'Verified', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending Review', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  more_info_required: { label: 'Needs More Info', style: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected: { label: 'Rejected', style: 'bg-rose-50 text-rose-700 border-rose-200' },
  unverified: { label: 'Unverified', style: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const ACCOUNT_STATUS_BADGES: Record<AccountStatus, { label: string; style: string }> = {
  active: { label: 'Active', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspended: { label: 'Suspended', style: 'bg-rose-50 text-rose-700 border-rose-200' },
  banned: { label: 'Banned', style: 'bg-slate-900 text-white border-slate-900' },
}

export default function AdminDashboard() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'verifications' | 'users' | 'audit'>('verifications')

  // Data states with localStorage persistence
  const [requests, setRequests] = useState<VerificationRequestItem[]>(() => {
    const saved = localStorage.getItem('rm_demo_verifications')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return DEMO_VERIFICATION_REQUESTS
  })

  const [users, setUsers] = useState<SystemUserItem[]>(() => {
    const saved = localStorage.getItem('rm_demo_system_users')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return DEMO_SYSTEM_USERS
  })

  const [auditLog, setAuditLog] = useState<VerificationAuditLog[]>(() => {
    const saved = localStorage.getItem('rm_demo_verification_audit_log')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return DEMO_VERIFICATION_AUDIT_LOG
  })

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Verification filtering
  const [verificationFilter, setVerificationFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  // User directory searching & filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all')

  // Modal dialog for decision / reason
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequestItem | null>(null)
  const [decisionAction, setDecisionAction] = useState<AffiliationVerificationStatus | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false)

  // User detail inspection modal
  const [inspectedUser, setInspectedUser] = useState<SystemUserItem | null>(null)

  // Save changes to localStorage
  const persistRequests = (updated: VerificationRequestItem[]) => {
    setRequests(updated)
    localStorage.setItem('rm_demo_verifications', JSON.stringify(updated))
  }

  const persistUsers = (updated: SystemUserItem[]) => {
    setUsers(updated)
    localStorage.setItem('rm_demo_system_users', JSON.stringify(updated))
  }

  const persistAuditLog = (updated: VerificationAuditLog[]) => {
    setAuditLog(updated)
    localStorage.setItem('rm_demo_verification_audit_log', JSON.stringify(updated))
  }

  // Handle open decision modal
  const handleOpenDecisionModal = (req: VerificationRequestItem, action: AffiliationVerificationStatus) => {
    setSelectedRequest(req)
    setDecisionAction(action)
    setDecisionNote(
      action === 'verified'
        ? 'Institutional affiliation confirmed via official university staff/student directory.'
        : action === 'more_info_required'
        ? 'Please provide an updated official enrollment letter or institutional staff card with current year validity.'
        : 'Unable to verify institutional affiliation with the submitted proof.'
    )
    setIsDecisionModalOpen(true)
  }

  // Confirm verification decision
  const handleConfirmDecision = () => {
    if (!selectedRequest || !decisionAction) return

    const now = new Date().toISOString()
    const updatedRequests = requests.map((r) =>
      r.id === selectedRequest.id
        ? {
            ...r,
            status: decisionAction,
            reviewedAt: now,
            reviewNote: decisionNote.trim(),
          }
        : r
    )
    persistRequests(updatedRequests)

    // Sync status into user directory
    const updatedUsers = users.map((u) =>
      u.uid === selectedRequest.userId
        ? {
            ...u,
            verificationStatus: decisionAction,
          }
        : u
    )
    persistUsers(updatedUsers)

    // Add entry to audit log
    const newAuditEntry: VerificationAuditLog = {
      id: `audit-${Date.now()}`,
      userId: selectedRequest.userId,
      userName: selectedRequest.userName,
      userRole: selectedRequest.userRole,
      decision: decisionAction,
      note: decisionNote.trim(),
      reviewer: 'System Administrator (Super Admin)',
      reviewedAt: now,
    }
    persistAuditLog([newAuditEntry, ...auditLog])

    // Also update student profile in localStorage if user matches
    const studentProfileStr = localStorage.getItem('rm_demo_student_profile')
    if (studentProfileStr) {
      try {
        const sp = JSON.parse(studentProfileStr)
        if (sp.uid === selectedRequest.userId || sp.email === selectedRequest.userEmail || selectedRequest.userId === 'demo-student') {
          sp.verificationStatus = decisionAction
          localStorage.setItem('rm_demo_student_profile', JSON.stringify(sp))
        }
      } catch {
        // ignore
      }
    }

    // Also update professor profile in localStorage if user matches
    const profProfileStr = localStorage.getItem('rm_demo_professor_profile')
    if (profProfileStr) {
      try {
        const pp = JSON.parse(profProfileStr)
        if (pp.uid === selectedRequest.userId || pp.email === selectedRequest.userEmail || selectedRequest.userId === 'demo-1') {
          pp.verificationStatus = decisionAction
          localStorage.setItem('rm_demo_professor_profile', JSON.stringify(pp))
        }
      } catch {
        // ignore
      }
    }

    setIsDecisionModalOpen(false)
    setToastMessage(`Updated ${selectedRequest.userName}'s status to ${VERIFICATION_BADGES[decisionAction].label}`)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Toggle user suspension
  const handleToggleUserSuspension = (targetUser: SystemUserItem) => {
    const nextStatus: AccountStatus = targetUser.accountStatus === 'active' ? 'suspended' : 'active'
    const updatedUsers = users.map((u) =>
      u.uid === targetUser.uid ? { ...u, accountStatus: nextStatus } : u
    )
    persistUsers(updatedUsers)

    // Update in requests too if present
    const updatedRequests = requests.map((r) =>
      r.userId === targetUser.uid ? { ...r, accountStatus: nextStatus } : r
    )
    persistRequests(updatedRequests)

    // Sync to suspended UIDs in localStorage
    const savedSuspendedStr = localStorage.getItem('rm_demo_suspended_uids')
    let suspendedUids: string[] = savedSuspendedStr ? JSON.parse(savedSuspendedStr) : []
    if (nextStatus === 'suspended') {
      if (!suspendedUids.includes(targetUser.uid)) suspendedUids.push(targetUser.uid)
      if (targetUser.email && !suspendedUids.includes(targetUser.email)) suspendedUids.push(targetUser.email)
    } else {
      suspendedUids = suspendedUids.filter((id) => id !== targetUser.uid && id !== targetUser.email)
    }
    localStorage.setItem('rm_demo_suspended_uids', JSON.stringify(suspendedUids))

    // If current demo student or professor matches, update their profile
    const studentProfileStr = localStorage.getItem('rm_demo_student_profile')
    if (studentProfileStr) {
      try {
        const sp = JSON.parse(studentProfileStr)
        if (sp.uid === targetUser.uid || sp.email === targetUser.email || targetUser.uid === 'demo-student') {
          sp.accountStatus = nextStatus
          localStorage.setItem('rm_demo_student_profile', JSON.stringify(sp))
        }
      } catch {}
    }

    const profProfileStr = localStorage.getItem('rm_demo_professor_profile')
    if (profProfileStr) {
      try {
        const pp = JSON.parse(profProfileStr)
        if (pp.uid === targetUser.uid || pp.email === targetUser.email || targetUser.uid === 'demo-1') {
          pp.accountStatus = nextStatus
          localStorage.setItem('rm_demo_professor_profile', JSON.stringify(pp))
        }
      } catch {}
    }

    setToastMessage(
      `Account for ${targetUser.displayName} marked as ${nextStatus.toUpperCase()}`
    )
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Statistics calculation
  const totalStudents = users.filter((u) => u.role === 'student').length
  const totalProfessors = users.filter((u) => u.role === 'professor').length
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length
  const verifiedUsersCount = users.filter((u) => u.verificationStatus === 'verified').length
  const suspendedUsersCount = users.filter((u) => u.accountStatus === 'suspended').length

  // Filtered requests
  const filteredRequests = requests.filter((r) => {
    if (verificationFilter !== 'all' && r.status !== verificationFilter) return false
    if (roleFilter !== 'all' && r.userRole !== roleFilter) return false
    return true
  })

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = u.displayName.toLowerCase().includes(q)
      const matchEmail = u.email.toLowerCase().includes(q)
      const matchUni = u.university.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchUni) return false
    }
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false
    if (userStatusFilter !== 'all' && u.verificationStatus !== userStatusFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50/70 pt-20 pb-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header & Role Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                Administration Console
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5 shadow-2xs">
                <Shield size={13} className="text-purple-600" />
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hybrid Institutional Affiliation Verification, User Governance & Audit Management
            </p>
          </div>

          {/* Navigation Tab Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl self-start sm:self-center">
            <button
              onClick={() => setActiveTab('verifications')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'verifications'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Verification Queue ({pendingRequestsCount})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              User Directory ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Log ({auditLog.length})
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fadeIn shadow-xs">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 5 High-Level Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">Total Students</span>
            <div className="text-2xl font-bold font-display text-slate-900 mt-1">{totalStudents}</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Verified & Registered</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">Total Professors</span>
            <div className="text-2xl font-bold font-display text-slate-900 mt-1">{totalProfessors}</div>
            <div className="text-[11px] text-indigo-600 font-medium mt-1">Global Institutions</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">Pending Review</span>
            <div className="text-2xl font-bold font-display text-amber-600 mt-1">{pendingRequestsCount}</div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">Requires Action</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">Verified Affiliations</span>
            <div className="text-2xl font-bold font-display text-emerald-600 mt-1">{verifiedUsersCount}</div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">Institutional Proof Confirmed</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-400">Suspended Users</span>
            <div className="text-2xl font-bold font-display text-rose-600 mt-1">{suspendedUsersCount}</div>
            <div className="text-[11px] text-rose-700 font-medium mt-1">Restricted Access</div>
          </div>
        </div>

        {/* TAB 1: VERIFICATION QUEUE */}
        {activeTab === 'verifications' && (
          <div className="space-y-4">
            {/* Filter Sub-bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mr-2">
                  <Filter size={13} className="text-blue-600" /> Status:
                </span>
                {['all', 'pending', 'more_info_required', 'verified', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setVerificationFilter(st)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      verificationFilter === st
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {st === 'all'
                      ? 'All Requests'
                      : st === 'pending'
                      ? 'Pending'
                      : st === 'more_info_required'
                      ? 'Needs Info'
                      : st === 'verified'
                      ? 'Verified'
                      : 'Rejected'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  <option value="all">All Roles</option>
                  <option value="professor">Professors Only</option>
                  <option value="student">Students Only</option>
                </select>
              </div>
            </div>

            {/* List of Verification Requests */}
            <div className="space-y-3.5">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar name={req.userName} size="md" className="w-12 h-12 rounded-xl text-sm" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold font-display text-slate-900">{req.userName}</h3>
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${VERIFICATION_BADGES[req.status].style}`}>
                            {VERIFICATION_BADGES[req.status].label}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            req.userRole === 'professor' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {req.userRole}
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-700 mt-1 flex items-center gap-1.5">
                          <Building size={13} className="text-blue-600" />
                          <span>{req.academicTitleOrDegree}</span>
                          <span>•</span>
                          <span className="font-semibold">{req.university}</span>
                          <span>({req.department})</span>
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>Institutional Email: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">{req.userEmail}</code></span>
                          <span>•</span>
                          <span>Submitted: {formatDate(req.submittedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                      <Button
                        size="sm"
                        variant={req.status === 'verified' ? 'primary' : 'outline'}
                        onClick={() => handleOpenDecisionModal(req, 'verified')}
                        className={`text-xs ${
                          req.status === 'verified'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <Check size={14} className="mr-1 text-emerald-600" />
                        Approve Affiliation
                      </Button>

                      <Button
                        size="sm"
                        variant={req.status === 'more_info_required' ? 'primary' : 'outline'}
                        onClick={() => handleOpenDecisionModal(req, 'more_info_required')}
                        className={`text-xs ${
                          req.status === 'more_info_required'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white border-transparent'
                            : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                        }`}
                      >
                        <AlertTriangle size={14} className="mr-1 text-purple-600" />
                        Request More Info
                      </Button>

                      <Button
                        size="sm"
                        variant={req.status === 'rejected' ? 'primary' : 'outline'}
                        onClick={() => handleOpenDecisionModal(req, 'rejected')}
                        className={`text-xs ${
                          req.status === 'rejected'
                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-transparent'
                            : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <X size={14} className="mr-1 text-rose-600" />
                        Reject Request
                      </Button>
                    </div>
                  </div>

                  {/* Document & Proof Inspection Panel */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-blue-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800">Uploaded Supporting Document: </span>
                        <span className="text-slate-600">{req.docType}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={req.docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Inspect Proof <ExternalLink size={12} />
                      </a>

                      {req.officialProfileUrl && (
                        <a
                          href={req.officialProfileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Official Directory <ArrowUpRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Previous Review Note if present */}
                  {req.reviewNote && (
                    <div className="text-xs bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-xl text-amber-900 flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Reviewer Log: </span>
                        <span className="italic">"{req.reviewNote}"</span>
                        {req.reviewedAt && (
                          <span className="text-amber-700 text-[11px] block mt-0.5">
                            Logged on {formatDate(req.reviewedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredRequests.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
                  <UserCheck size={36} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No verification requests found</p>
                  <p className="text-xs text-slate-500 mt-1">Try resetting the status filter above.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USER DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user by name, email, or institution..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Role:</span>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 font-medium"
                  >
                    <option value="all">All Roles</option>
                    <option value="professor">Professors</option>
                    <option value="student">Students</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Verification:</span>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 font-medium"
                  >
                    <option value="all">All Statuses</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="more_info_required">Needs Info</option>
                    <option value="unverified">Unverified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">University & Department</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.displayName} size="sm" />
                            <div>
                              <p className="font-bold text-slate-900">{u.displayName}</p>
                              <p className="text-[11px] text-slate-400 font-normal">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            u.role === 'professor' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">{u.university}</p>
                          <p className="text-[11px] text-slate-400">{u.department}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_BADGES[u.verificationStatus]?.style || 'bg-slate-100 text-slate-600'}`}>
                            {VERIFICATION_BADGES[u.verificationStatus]?.label || u.verificationStatus}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ACCOUNT_STATUS_BADGES[u.accountStatus]?.style || 'bg-slate-100 text-slate-600'}`}>
                            {ACCOUNT_STATUS_BADGES[u.accountStatus]?.label || u.accountStatus}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setInspectedUser(u)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold p-1 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Inspect Details"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              onClick={() => handleToggleUserSuspension(u)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                                u.accountStatus === 'active'
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {u.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PLATFORM AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  Institutional Verification Decision Audit Trail
                </h2>
                <span className="text-xs text-slate-500">{auditLog.length} recorded events</span>
              </div>

              <div className="space-y-3.5">
                {auditLog.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.userName}</span>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          log.userRole === 'professor' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {log.userRole}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_BADGES[log.decision]?.style}`}>
                          {VERIFICATION_BADGES[log.decision]?.label}
                        </span>
                      </div>

                      {log.note && (
                        <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100 mt-1">
                          "{log.note}"
                        </p>
                      )}
                    </div>

                    <div className="text-right sm:shrink-0 text-slate-400 text-[11px]">
                      <div>{formatDate(log.reviewedAt)}</div>
                      <div className="text-slate-600 font-medium mt-0.5">By: {log.reviewer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Verification Decision Modal */}
      {isDecisionModalOpen && selectedRequest && decisionAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 font-display">
                Confirm Verification Decision
              </h3>
              <button
                type="button"
                onClick={() => setIsDecisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <p><strong>Candidate:</strong> {selectedRequest.userName} ({selectedRequest.userRole})</p>
              <p><strong>Affiliation:</strong> {selectedRequest.university} — {selectedRequest.department}</p>
              <p><strong>Action:</strong> Set status to <span className="font-semibold underline">{VERIFICATION_BADGES[decisionAction].label}</span></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Administrative Review Reason / Internal Note
              </label>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Enter justification or instructions for the applicant..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDecisionModalOpen(false)}
                className="text-xs text-slate-600"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDecision}
                className={`text-xs text-white font-medium ${
                  decisionAction === 'verified'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionAction === 'more_info_required'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {VERIFICATION_BADGES[decisionAction].label}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Inspection Modal */}
      {inspectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 font-display">User Record Details</h3>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <Avatar name={inspectedUser.displayName} size="md" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">{inspectedUser.displayName}</h4>
                <p className="text-xs text-slate-500">{inspectedUser.email}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">System Role:</span>
                <span className="font-semibold text-slate-900 capitalize">{inspectedUser.role}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">University:</span>
                <span className="font-semibold text-slate-900">{inspectedUser.university}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Department:</span>
                <span className="font-semibold text-slate-900">{inspectedUser.department}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Degree / Position:</span>
                <span className="font-semibold text-slate-900">{inspectedUser.academicTitleOrDegree}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Affiliation Verification:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold border ${VERIFICATION_BADGES[inspectedUser.verificationStatus]?.style}`}>
                  {VERIFICATION_BADGES[inspectedUser.verificationStatus]?.label}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Account Governance:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold border ${ACCOUNT_STATUS_BADGES[inspectedUser.accountStatus]?.style}`}>
                  {ACCOUNT_STATUS_BADGES[inspectedUser.accountStatus]?.label}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectedUser(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
