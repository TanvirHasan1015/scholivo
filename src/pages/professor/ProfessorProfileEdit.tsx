import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import {
  GraduationCap, BookOpen, Globe, Save, Check,
  ArrowLeft, Plus, Trash2, AlertCircle,
  Building, Users, Eye, Edit3, X, DollarSign
} from 'lucide-react'
import { db } from '@/lib/firebase'
import {
  buildDirectoryEntryFromProfessor,
  sanitizePublicProfessorPayload,
  stripLegacyProfessorEmailIfPresent,
  syncUserDirectoryEntry,
} from '@/lib/messaging'
import {
  PROFESSOR_FUNDING_STATUS_OPTIONS,
  PROFESSOR_FUNDING_TYPE_OPTIONS,
  createEmptyProfessorFundingInfo,
  hasProfessorFundingInfo,
  normalizeProfessorFundingInfo,
} from '@/lib/professorFunding'
import { useAuth } from '@/context/AuthContext'
import type {
  ProfessorFundingAvailabilityStatus,
  ProfessorFundingInfo,
  ProfessorFundingSourceType,
  ProfessorProfile,
  ResearchProject,
  RecruitingStatus,
} from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { ProfilePhotoUploader } from '@/components/common/ProfilePhotoUploader'
import { COUNTRIES } from '@/utils/helpers'

function createEmptyProfessorProfile(uid = '', email = '', displayName = '', photoURL?: string): ProfessorProfile {
  const now = new Date().toISOString()
  return {
    uid,
    fullName: displayName,
    username: email ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '',
    email,
    academicTitle: 'Associate Professor',
    country: 'South Korea',
    photoURL,
    university: '',
    department: '',
    faculty: '',
    universityProfileUrl: '',
    googleScholarUrl: '',
    orcid: '',
    personalWebpageUrl: '',
    biography: '',
    researchAreas: [],
    researchInterests: [],
    currentProjects: [],
    publications: [],
    labName: '',
    labDescription: '',
    labWebsiteUrl: '',
    labMembers: [],
    isRecruiting: true,
    recruitingStatus: 'actively_recruiting',
    fundingInfo: createEmptyProfessorFundingInfo(),
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeProfessorProfile(
  raw: Partial<ProfessorProfile>,
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string
): ProfessorProfile {
  const base = createEmptyProfessorProfile(uid, email, displayName, photoURL)
  return {
    ...base,
    ...raw,
    uid: raw.uid || uid,
    email: raw.email || email,
    fullName: raw.fullName ?? displayName,
    researchAreas: Array.isArray(raw.researchAreas) ? raw.researchAreas : [],
    researchInterests: Array.isArray(raw.researchInterests) ? raw.researchInterests : [],
    currentProjects: Array.isArray(raw.currentProjects) ? raw.currentProjects : [],
    publications: Array.isArray(raw.publications) ? raw.publications : [],
    labMembers: Array.isArray(raw.labMembers) ? raw.labMembers : [],
    recruitingStatus: raw.recruitingStatus || 'actively_recruiting',
    isRecruiting:
      typeof raw.isRecruiting === 'boolean'
        ? raw.isRecruiting
        : (raw.recruitingStatus || 'actively_recruiting') === 'actively_recruiting',
    fundingInfo: normalizeProfessorFundingInfo(raw.fundingInfo),
  }
}

export default function ProfessorProfileEdit() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [profile, setProfile] = useState<ProfessorProfile>(() =>
    createEmptyProfessorProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [savedSnapshot, setSavedSnapshot] = useState<ProfessorProfile | null>(null)
  const [isEditing, setIsEditing] = useState(() => searchParams.get('edit') === 'true')
  const [supportedStudentsInput, setSupportedStudentsInput] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const syncSupportedStudentsInput = (p: ProfessorProfile) => {
    const count = p.fundingInfo?.supportedStudentsCount
    setSupportedStudentsInput(
      typeof count === 'number' && !Number.isNaN(count) && count >= 0 ? String(count) : ''
    )
  }

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'professors', user.uid))
        if (!isMounted) return
        if (snap.exists()) {
          const rawProf = snap.data() as Record<string, unknown>
          stripLegacyProfessorEmailIfPresent(user.uid, rawProf)
          const normalized = normalizeProfessorProfile(
            rawProf as Partial<ProfessorProfile>,
            user.uid,
            user.email || '',
            user.displayName || '',
            user.photoURL || undefined
          )
          setProfile(normalized)
          setSavedSnapshot(normalized)
          syncSupportedStudentsInput(normalized)
          syncUserDirectoryEntry(buildDirectoryEntryFromProfessor(normalized)).catch(() => {
            // Non-blocking directory backfill
          })
        } else {
          const empty = createEmptyProfessorProfile(
            user.uid,
            user.email || '',
            user.displayName || '',
            user.photoURL || undefined
          )
          setProfile(empty)
          setSavedSnapshot(empty)
          syncSupportedStudentsInput(empty)
        }
        setErrorMsg(null)
      } catch (err) {
        console.error('Error loading professor profile from Firestore:', err)
        if (isMounted) {
          setErrorMsg('Failed to load your faculty profile from the server. Please refresh and try again.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  const handleStartEditing = () => {
    setErrorMsg(null)
    setSaveSuccess(false)
    syncSupportedStudentsInput(profile)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setErrorMsg(null)
    if (savedSnapshot) {
      setProfile(savedSnapshot)
      syncSupportedStudentsInput(savedSnapshot)
    }
    setIsEditing(false)
    if (searchParams.has('edit')) {
      setSearchParams({}, { replace: true })
    }
  }

  const handlePhotoSaved = async (newPhotoUrl: string) => {
    if (!user) return
    const now = new Date().toISOString()
    const nextProfile: ProfessorProfile = {
      ...profile,
      uid: user.uid,
      photoURL: newPhotoUrl,
      updatedAt: now,
    }
    setProfile(nextProfile)
    setSavedSnapshot((prev) => (prev ? { ...prev, photoURL: newPhotoUrl, updatedAt: now } : nextProfile))

    const firestorePayload = sanitizePublicProfessorPayload(
      user.uid,
      nextProfile as unknown as Record<string, unknown>
    )
    await setDoc(doc(db, 'professors', user.uid), firestorePayload)
    await syncUserDirectoryEntry(buildDirectoryEntryFromProfessor(nextProfile)).catch(() => {
      // Non-blocking directory sync
    })
    await setDoc(
      doc(db, 'users', user.uid),
      { photoURL: newPhotoUrl, updatedAt: now },
      { merge: true }
    ).catch(() => {
      // Non-blocking users/{uid} photoURL sync
    })
    try {
      const ownedPosSnap = await getDocs(
        query(collection(db, 'positions'), where('professorId', '==', user.uid))
      )
      await Promise.allSettled(
        ownedPosSnap.docs.map((posDoc) =>
          updateDoc(doc(db, 'positions', posDoc.id), {
            professorPhotoURL: newPhotoUrl,
            updatedAt: now,
          })
        )
      )
    } catch {
      // Non-blocking position photo sync
    }
  }

  const updateFundingInfo = (patch: Partial<ProfessorFundingInfo>) => {
    setProfile((prev) => ({
      ...prev,
      fundingInfo: {
        ...normalizeProfessorFundingInfo(prev.fundingInfo),
        ...patch,
      },
    }))
  }

  const toggleFundingType = (typeId: ProfessorFundingSourceType) => {
    if (!isEditing) return
    const current = normalizeProfessorFundingInfo(profile.fundingInfo)
    const exists = current.fundingTypes.includes(typeId)
    const nextTypes = exists
      ? current.fundingTypes.filter((t) => t !== typeId)
      : [...current.fundingTypes, typeId]
    updateFundingInfo({
      fundingTypes: nextTypes,
      ...(typeId === 'other' && exists ? { otherFundingTypeExplanation: '' } : {}),
    })
  }

  const clearFundingInfo = () => {
    if (!isEditing) return
    setSupportedStudentsInput('')
    setProfile((prev) => ({
      ...prev,
      fundingInfo: createEmptyProfessorFundingInfo(),
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const currentFunding = normalizeProfessorFundingInfo(profile.fundingInfo)
    if (
      currentFunding.fundingTypes.includes('other') &&
      !(currentFunding.otherFundingTypeExplanation || '').trim()
    ) {
      setErrorMsg('Please provide a brief explanation when "Other" funding type is selected.')
      return
    }

    let resolvedSupportedCount: number | null = null
    const trimmedSupported = supportedStudentsInput.trim()
    if (trimmedSupported !== '') {
      const parsedCount = Number(trimmedSupported)
      if (!Number.isInteger(parsedCount) || parsedCount < 0 || parsedCount > 500) {
        setErrorMsg('Number of supported students must be a whole number between 0 and 500.')
        return
      }
      resolvedSupportedCount = parsedCount
    }

    const cleanedFundingInfo: ProfessorFundingInfo = {
      fundingTypes: currentFunding.fundingTypes,
      otherFundingTypeExplanation: currentFunding.fundingTypes.includes('other')
        ? (currentFunding.otherFundingTypeExplanation || '').trim().slice(0, 300)
        : '',
      fundingStatus: currentFunding.fundingStatus || '',
      description: (currentFunding.description || '').trim().slice(0, 2000),
      supportedStudentsCount: resolvedSupportedCount,
      eligibilityRequirements: (currentFunding.eligibilityRequirements || '').trim().slice(0, 2000),
      additionalNotes: (currentFunding.additionalNotes || '').trim().slice(0, 2000),
    }

    setSaving(true)
    setErrorMsg(null)

    const now = new Date().toISOString()
    const updated: ProfessorProfile = {
      ...profile,
      uid: user.uid,
      email: profile.email || user.email || '',
      fundingInfo: cleanedFundingInfo,
      updatedAt: now,
    }

    try {
      const firestorePayload = sanitizePublicProfessorPayload(
        user.uid,
        updated as unknown as Record<string, unknown>
      )
      await setDoc(doc(db, 'professors', user.uid), firestorePayload)
      try {
        await syncUserDirectoryEntry(buildDirectoryEntryFromProfessor(updated))
      } catch (dirErr) {
        console.warn('Could not sync professor directory entry:', dirErr)
      }
      if (updated.fullName) {
        await setDoc(
          doc(db, 'users', user.uid),
          { displayName: updated.fullName, updatedAt: now },
          { merge: true }
        ).catch(() => {
          // Non-blocking displayName sync
        })
      }

      // Sync denormalized professor metadata onto existing owned positions so opportunities never become stale
      try {
        const ownedPosSnap = await getDocs(
          query(collection(db, 'positions'), where('professorId', '==', user.uid))
        )
        await Promise.allSettled(
          ownedPosSnap.docs.map((posDoc) =>
            updateDoc(doc(db, 'positions', posDoc.id), {
              professorName: updated.fullName || user.displayName || 'Faculty Member',
              professorTitle: updated.academicTitle || 'Professor',
              university: updated.university || '',
              department: updated.department || '',
              country: updated.country || '',
              updatedAt: now,
            })
          )
        )
      } catch (posSyncErr) {
        console.warn('Could not sync denormalized professor metadata onto positions:', posSyncErr)
      }

      setProfile(updated)
      setSavedSnapshot(updated)
      syncSupportedStudentsInput(updated)
      setIsEditing(false)
      if (searchParams.has('edit')) {
        setSearchParams({}, { replace: true })
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Firestore professor profile update error:', err)
      setErrorMsg('Failed to save your faculty profile changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Add Project
  const addProject = () => {
    const newProj: ResearchProject = {
      id: `proj-${Date.now()}`,
      title: '',
      description: '',
      fundingSource: '',
      isOngoing: true,
      startDate: new Date().toISOString().slice(0, 7),
    }
    setProfile({
      ...profile,
      currentProjects: [...(profile.currentProjects || []), newProj],
    })
  }

  const removeProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this funded project?')) return
    const nextProjects = (profile.currentProjects || []).filter((p) => p.id !== id)
    const now = new Date().toISOString()
    const nextProfile: ProfessorProfile = {
      ...profile,
      currentProjects: nextProjects,
      updatedAt: now,
    }
    setProfile(nextProfile)

    if (user) {
      try {
        const firestorePayload = sanitizePublicProfessorPayload(
          user.uid,
          nextProfile as unknown as Record<string, unknown>
        )
        await setDoc(doc(db, 'professors', user.uid), firestorePayload)
        setSavedSnapshot((prev) =>
          prev ? { ...prev, currentProjects: nextProjects, updatedAt: now } : nextProfile
        )
      } catch (err) {
        console.warn('Could not immediately persist project deletion:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading your faculty profile…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200/80 gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate('/dashboard/professor')}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
                  Faculty Profile & Lab Settings
                </h1>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    isEditing
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isEditing ? 'Editing Mode' : 'View Mode'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {isEditing
                  ? 'Update your academic appointments, research topics, ongoing grants, and recruitment status'
                  : 'Review your faculty credentials, lab details, and funded research programs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/professor/${profile.username || user?.uid || ''}`)}
              className="flex items-center gap-1.5 text-xs font-semibold"
              id="view-public-profile-btn"
            >
              <Eye size={14} />
              <span>Public Profile</span>
            </Button>

            {saveSuccess && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 animate-fade-in">
                <Check size={14} className="text-emerald-600" />
                <span>Profile Saved</span>
              </span>
            )}

            {!isEditing ? (
              <Button
                type="button"
                onClick={handleStartEditing}
                className="flex items-center gap-2 shadow-xs"
                id="edit-professor-profile-btn"
              >
                <Edit3 size={15} />
                <span>Edit Profile</span>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5"
                  id="cancel-professor-profile-btn"
                >
                  <X size={15} />
                  <span>Cancel</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 shadow-xs"
                  id="save-profile-top-btn"
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Profile Card Summary Banner */}
        <div
          className={`bg-white rounded-3xl p-6 sm:p-8 border shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-6 transition-colors ${
            isEditing ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-slate-200/80'
          }`}
        >
          <ProfilePhotoUploader
            uid={user?.uid || ''}
            name={profile.fullName || 'Faculty'}
            currentPhotoURL={profile.photoURL}
            isEditing={isEditing}
            onPhotoSaved={handlePhotoSaved}
          />
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                {profile.fullName || 'Faculty Member'}
              </h2>
            </div>
            <p className="text-sm font-semibold text-blue-600">
              {profile.academicTitle || 'Faculty'} • {profile.department || 'Department not set'}
            </p>
            <p className="text-xs text-slate-500">{profile.university || 'University not set'}, {profile.country}</p>
            <p className="text-xs text-slate-400">{profile.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8" id="professor-profile-form">
          
          {/* Section 1: Academic Identity & Affiliation */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Building size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Academic Affiliation</h3>
                <p className="text-xs text-slate-500">Official university role, department, and recruitment status</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-fullName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Academic Title / Position
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.academicTitle}
                  onChange={(e) => setProfile({ ...profile, academicTitle: e.target.value })}
                  placeholder="e.g. Associate Professor, Chair Professor"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-academicTitle"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  University / Institute
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.university}
                  onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-university"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Department / School
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-department"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <select
                  disabled={!isEditing}
                  value={profile.country}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-country"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Recruiting Status
                </label>
                <select
                  disabled={!isEditing}
                  value={profile.recruitingStatus}
                  onChange={(e) => {
                    const status = e.target.value as RecruitingStatus
                    setProfile({
                      ...profile,
                      recruitingStatus: status,
                      isRecruiting: status === 'actively_recruiting',
                    })
                  }}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-recruitingStatus"
                >
                  <option value="actively_recruiting">Actively Recruiting Students</option>
                  <option value="sometimes">Occasionally Reviewing Candidates</option>
                  <option value="not_recruiting">Not Currently Recruiting</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Faculty Biography & Mission
                </label>
                <textarea
                  rows={4}
                  disabled={!isEditing}
                  value={profile.biography}
                  onChange={(e) => setProfile({ ...profile, biography: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-biography"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Research Areas & Focus */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Research Fields & Specializations</h3>
                <p className="text-xs text-slate-500">Keywords used by students to discover your lab openings</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <TagInput
                  label="Primary Research Areas"
                  tags={profile.researchAreas}
                  onChange={(tags) => setProfile((prev) => ({ ...prev, researchAreas: tags }))}
                  placeholder="e.g. Computer Vision, Medical AI, Deep Learning"
                  disabled={!isEditing}
                />
              </div>

              <div>
                <TagInput
                  label="Specific Research Topics & Methodologies"
                  tags={profile.researchInterests}
                  onChange={(tags) => setProfile((prev) => ({ ...prev, researchInterests: tags }))}
                  placeholder="e.g. Diffusion Models, Image Segmentation, 3D Vision"
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Laboratory Information */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Lab Information</h3>
                <p className="text-xs text-slate-500">Group profile, website link, and alumni highlights</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Laboratory / Research Group Name
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.labName || ''}
                  onChange={(e) => setProfile({ ...profile, labName: e.target.value })}
                  placeholder="e.g. Visual Intelligence & Medical AI Lab"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Lab Website URL
                </label>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.labWebsiteUrl || ''}
                  onChange={(e) => setProfile({ ...profile, labWebsiteUrl: e.target.value })}
                  placeholder="https://lab.university.edu"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labUrl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Lab Description & Culture
                </label>
                <textarea
                  rows={3}
                  disabled={!isEditing}
                  value={profile.labDescription || ''}
                  onChange={(e) => setProfile({ ...profile, labDescription: e.target.value })}
                  placeholder="Describe your research environment, group members, compute resources, and lab culture…"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labDesc"
                />
              </div>
            </div>
          </div>

          {/* Section 3b: Professor Funding Information & Student Support Availability */}
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6"
            id="prof-funding-info-section"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    Funding Information & Availability
                  </h3>
                  <p className="text-xs text-slate-500">
                    Current graduate student funding sources, availability status, and support capacity (distinct from individual grants below)
                  </p>
                </div>
              </div>

              {isEditing && hasProfessorFundingInfo(profile.fundingInfo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFundingInfo}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 self-start sm:self-center"
                  id="clear-funding-info-btn"
                >
                  Clear Funding Info
                </Button>
              )}
            </div>

            <div className="space-y-5">
              {/* Funding Types (Multi-select) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Funding Types (Select all that apply)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PROFESSOR_FUNDING_TYPE_OPTIONS.map((opt) => {
                    const selected = (profile.fundingInfo?.fundingTypes || []).includes(opt.id)
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          selected
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-semibold'
                            : 'bg-slate-50/60 border-slate-200 text-slate-700'
                        } ${isEditing ? 'cursor-pointer hover:border-emerald-300' : 'opacity-80 cursor-default'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!isEditing}
                          checked={selected}
                          onChange={() => toggleFundingType(opt.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          id={`prof-funding-type-${opt.id}`}
                        />
                        <span>{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Conditional Other Funding Type Explanation */}
              {(profile.fundingInfo?.fundingTypes || []).includes('other') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Explain "Other" Funding Type *
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={profile.fundingInfo?.otherFundingTypeExplanation || ''}
                    onChange={(e) =>
                      updateFundingInfo({ otherFundingTypeExplanation: e.target.value })
                    }
                    placeholder="e.g. Joint international foundation fellowship or endowed chair support"
                    className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="prof-funding-other-explanation"
                  />
                </div>
              )}

              {/* Current Funding Status & Supported Student Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Current Funding Status
                  </label>
                  <select
                    disabled={!isEditing}
                    value={profile.fundingInfo?.fundingStatus || ''}
                    onChange={(e) =>
                      updateFundingInfo({
                        fundingStatus: e.target.value as ProfessorFundingAvailabilityStatus | '',
                      })
                    }
                    className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="prof-funding-status"
                  >
                    <option value="">Not specified</option>
                    {PROFESSOR_FUNDING_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Students Currently Supportable (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    disabled={!isEditing}
                    value={supportedStudentsInput}
                    onChange={(e) => setSupportedStudentsInput(e.target.value)}
                    placeholder="Leave blank if unknown (e.g. 2)"
                    className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="prof-funding-supported-count"
                  />
                </div>
              </div>

              {/* Funding Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Funding Description (Optional)
                </label>
                <textarea
                  rows={2}
                  disabled={!isEditing}
                  value={profile.fundingInfo?.description || ''}
                  onChange={(e) => updateFundingInfo({ description: e.target.value })}
                  placeholder="e.g. Full tuition waiver plus monthly research assistant stipend covered by lab grants…"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-funding-description"
                />
              </div>

              {/* Eligibility / Requirements & Additional Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Funding Eligibility / Requirements (Optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isEditing}
                    value={profile.fundingInfo?.eligibilityRequirements || ''}
                    onChange={(e) =>
                      updateFundingInfo({ eligibilityRequirements: e.target.value })
                    }
                    placeholder="e.g. Full-time MS/PhD enrollment required; RA duties 20 hrs/week…"
                    className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="prof-funding-eligibility"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Additional Funding Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isEditing}
                    value={profile.fundingInfo?.additionalNotes || ''}
                    onChange={(e) => updateFundingInfo({ additionalNotes: e.target.value })}
                    placeholder="e.g. Conference travel and GPU cluster access are additionally supported…"
                    className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="prof-funding-notes"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Current Funded Projects */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Funded Projects & Grants</h3>
                  <p className="text-xs text-slate-500">Active research programs providing graduate student support</p>
                </div>
              </div>

              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProject}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  id="add-project-btn"
                >
                  <Plus size={13} />
                  <span>Add Project</span>
                </Button>
              )}
            </div>

            {(profile.currentProjects || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No funded research projects listed yet.
              </p>
            ) : (
              <div className="space-y-4">
                {(profile.currentProjects || []).map((project, index) => (
                  <div
                    key={project.id}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={project.title}
                          onChange={(e) => {
                            const updated = [...(profile.currentProjects || [])]
                            updated[index] = { ...updated[index], title: e.target.value }
                            setProfile({ ...profile, currentProjects: updated })
                          }}
                          placeholder="Project Title"
                          className="bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                        />
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={project.fundingSource || ''}
                          onChange={(e) => {
                            const updated = [...(profile.currentProjects || [])]
                            updated[index] = { ...updated[index], fundingSource: e.target.value }
                            setProfile({ ...profile, currentProjects: updated })
                          }}
                          placeholder="Funding Agency (e.g. NRF, NSF, Industry)"
                          className="bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                        />
                      </div>

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeProject(project.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                          title="Remove Project"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      disabled={!isEditing}
                      value={project.description}
                      onChange={(e) => {
                        const updated = [...(profile.currentProjects || [])]
                        updated[index] = { ...updated[index], description: e.target.value }
                        setProfile({ ...profile, currentProjects: updated })
                      }}
                      placeholder="Brief description of objectives and student roles…"
                      className="w-full bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: External Links & Scholar Profiles */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Globe size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Academic Profiles & Online Portals</h3>
                <p className="text-xs text-slate-500">Links for prospective students to inspect your published record</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  University Faculty Profile URL
                </label>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.universityProfileUrl || ''}
                  onChange={(e) => setProfile({ ...profile, universityProfileUrl: e.target.value })}
                  placeholder="https://cs.university.edu/~prof"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-facultyUrl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Google Scholar URL
                </label>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.googleScholarUrl || ''}
                  onChange={(e) => setProfile({ ...profile, googleScholarUrl: e.target.value })}
                  placeholder="https://scholar.google.com/citations?user=..."
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-scholarUrl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  ORCID Identifier
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.orcid || ''}
                  onChange={(e) => setProfile({ ...profile, orcid: e.target.value })}
                  placeholder="0000-0002-1825-0097"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-orcid"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Personal / Lab Website
                </label>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.personalWebpageUrl || ''}
                  onChange={(e) => setProfile({ ...profile, personalWebpageUrl: e.target.value })}
                  placeholder="https://cvlab.university.edu"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-webpageUrl"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer (Visible only in Edit Mode) */}
          {isEditing && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertCircle size={14} className="text-blue-600" />
                <span>Changes are saved directly to your Scholivo faculty profile.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEditing}
                  disabled={saving}
                  className="flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-8 py-3 flex-1 sm:flex-initial shadow-xs"
                  id="save-profile-bottom-btn"
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving Changes…' : 'Save Faculty Profile'}</span>
                </Button>
              </div>
            </div>
          )}

        </form>

      </div>
    </div>
  )
}
