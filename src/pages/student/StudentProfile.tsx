import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import {
  GraduationCap, BookOpen, Cpu,
  Save, Check, Award, FileText, ArrowLeft, Plus, Trash2,
  ExternalLink, AlertCircle, Edit3, X, Upload
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { validateCvFile, uploadProfileCvFile, formatCvUploadError } from '@/lib/cvUpload'
import {
  buildDirectoryEntryFromStudent,
  loadSplitStudentProfile,
  saveSplitStudentProfile,
  syncUserDirectoryEntry,
} from '@/lib/messaging'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ResearchExperience, LanguageScore, Publication } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { ProfilePhotoUploader } from '@/components/common/ProfilePhotoUploader'

import { calculateProfileCompleteness } from '@/utils/helpers'

const EXAM_TYPE_OPTIONS: LanguageScore['type'][] = [
  'TOEFL',
  'IELTS',
  'GRE',
  'GMAT',
  'TOPIK',
  'Other',
]

function createEmptyStudentProfile(uid = '', email = '', displayName = '', photoURL?: string): StudentProfile {
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
    cvUrl: '',
    transcriptUrl: '',
    portfolioUrl: '',
    profileCompleteness: 0,
    bio: '',
    createdAt: now,
    updatedAt: now,
  }
  return {
    ...base,
    profileCompleteness: calculateProfileCompleteness(base),
  }
}

function normalizeStudentProfile(
  raw: Partial<StudentProfile>,
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string
): StudentProfile {
  const base = createEmptyStudentProfile(uid, email, displayName, photoURL)
  const merged: StudentProfile = {
    ...base,
    ...raw,
    uid: raw.uid || uid,
    email: raw.email || email,
    fullName: raw.fullName ?? displayName,
    gpa: typeof raw.gpa === 'number' && !Number.isNaN(raw.gpa) ? raw.gpa : 0,
    gpaScale:
      typeof raw.gpaScale === 'number' && !Number.isNaN(raw.gpaScale) && raw.gpaScale > 0
        ? raw.gpaScale
        : 4.0,
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
  }
  return {
    ...merged,
    profileCompleteness: calculateProfileCompleteness(merged),
  }
}

export default function StudentProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [profile, setProfile] = useState<StudentProfile>(() =>
    createEmptyStudentProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [savedSnapshot, setSavedSnapshot] = useState<StudentProfile | null>(null)
  const [isEditing, setIsEditing] = useState(() => searchParams.get('edit') === 'true')

  // String states for GPA and GPA scale so users can clear the input without it snapping to "0"
  const [gpaInput, setGpaInput] = useState('')
  const [gpaScaleInput, setGpaScaleInput] = useState('4.0')

  const [uploadingCv, setUploadingCv] = useState(false)
  const [cvUploadSuccess, setCvUploadSuccess] = useState(false)
  const cvFileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const syncGpaInputsFromProfile = (p: StudentProfile) => {
    setGpaInput(p.gpa > 0 ? String(p.gpa) : '')
    setGpaScaleInput(p.gpaScale > 0 ? String(p.gpaScale) : '4.0')
  }

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }
      try {
        const loaded = await loadSplitStudentProfile(user.uid)
        if (!isMounted) return
        if (loaded.exists) {
          const normalized = normalizeStudentProfile(
            loaded.data,
            user.uid,
            user.email || '',
            user.displayName || '',
            user.photoURL || undefined
          )
          setProfile(normalized)
          setSavedSnapshot(normalized)
          syncGpaInputsFromProfile(normalized)
          syncUserDirectoryEntry(buildDirectoryEntryFromStudent(normalized)).catch(() => {
            // Non-blocking directory backfill
          })
        } else {
          const empty = createEmptyStudentProfile(
            user.uid,
            user.email || '',
            user.displayName || '',
            user.photoURL || undefined
          )
          setProfile(empty)
          setSavedSnapshot(empty)
          syncGpaInputsFromProfile(empty)
        }
        setErrorMsg(null)
      } catch (err) {
        console.error('Failed to load student profile from Firestore:', err)
        if (isMounted) {
          setErrorMsg('Failed to load your profile from the server. Please check your connection and refresh.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      isMounted = false
    }
  }, [user])

  const handleStartEditing = () => {
    setErrorMsg(null)
    setSaveSuccess(false)
    syncGpaInputsFromProfile(profile)
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setErrorMsg(null)
    if (savedSnapshot) {
      setProfile(savedSnapshot)
      syncGpaInputsFromProfile(savedSnapshot)
    }
    setIsEditing(false)
    if (searchParams.has('edit')) {
      setSearchParams({}, { replace: true })
    }
  }

  const handlePhotoSaved = async (newPhotoUrl: string) => {
    if (!user) return
    const now = new Date().toISOString()
    const nextProfile: StudentProfile = {
      ...profile,
      uid: user.uid,
      photoURL: newPhotoUrl,
      updatedAt: now,
    }
    setProfile(nextProfile)
    setSavedSnapshot((prev) => (prev ? { ...prev, photoURL: newPhotoUrl, updatedAt: now } : nextProfile))

    const firestorePayload = Object.fromEntries(
      Object.entries(nextProfile).filter(([, v]) => v !== undefined)
    )
    await saveSplitStudentProfile(user.uid, firestorePayload)
    await syncUserDirectoryEntry(buildDirectoryEntryFromStudent(nextProfile)).catch(() => {
      // Non-blocking directory sync
    })
    await setDoc(
      doc(db, 'users', user.uid),
      { photoURL: newPhotoUrl, updatedAt: now },
      { merge: true }
    ).catch(() => {
      // Non-blocking users/{uid} photoURL sync
    })
  }

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateCvFile(file)
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please select a PDF, DOC, or DOCX file under 10 MB.')
      e.target.value = ''
      return
    }

    setUploadingCv(true)
    setCvUploadSuccess(false)
    setErrorMsg(null)
    try {
      const downloadUrl = await uploadProfileCvFile(user.uid, file)
      setProfile((prev) => ({ ...prev, cvUrl: downloadUrl }))
      setCvUploadSuccess(true)
    } catch (err) {
      console.error('Failed to upload CV to Firebase Storage:', err)
      setErrorMsg(formatCvUploadError(err))
    } finally {
      setUploadingCv(false)
      e.target.value = ''
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setErrorMsg(null)

    // Validate GPA and GPA Scale
    const trimmedGpa = gpaInput.trim()
    const trimmedScale = gpaScaleInput.trim()

    let resolvedScale = 4.0
    if (trimmedScale !== '') {
      const parsedScale = Number(trimmedScale)
      if (Number.isNaN(parsedScale) || parsedScale <= 0 || parsedScale > 100) {
        setErrorMsg('Please enter a valid GPA scale (for example 4.0, 4.3, 4.5, or 5.0).')
        return
      }
      resolvedScale = Math.round(parsedScale * 100) / 100
    }

    let resolvedGpa = 0
    if (trimmedGpa !== '') {
      const parsedGpa = Number(trimmedGpa)
      if (Number.isNaN(parsedGpa) || parsedGpa < 0) {
        setErrorMsg('Please enter a valid non-negative GPA value.')
        return
      }
      if (parsedGpa > resolvedScale) {
        setErrorMsg(`Cumulative GPA (${parsedGpa}) cannot exceed the GPA scale (${resolvedScale}).`)
        return
      }
      resolvedGpa = Math.round(parsedGpa * 100) / 100
    }

    // Clean languageScores (keep entries that have a non-empty score)
    const cleanedLanguageScores = profile.languageScores
      .map((ls) => ({
        ...ls,
        score: String(ls.score ?? '').trim(),
      }))
      .filter((ls) => ls.score.length > 0)

    // Clean publications (keep entries with a non-empty title)
    const cleanedPublications = profile.publications
      .map((pub) => ({
        ...pub,
        title: String(pub.title ?? '').trim(),
        conference: String(pub.conference ?? '').trim(),
        journal: String(pub.journal ?? '').trim(),
        doi: String(pub.doi ?? '').trim(),
        url: String(pub.url ?? '').trim(),
        year: Number(pub.year) || new Date().getFullYear(),
        authors: Array.isArray(pub.authors)
          ? pub.authors.map((a) => String(a).trim()).filter(Boolean)
          : [],
      }))
      .filter((pub) => pub.title.length > 0)

    setSaving(true)

    const now = new Date().toISOString()
    const draftWithUpdatedFields: StudentProfile = {
      ...profile,
      uid: user.uid,
      email: profile.email || user.email || '',
      gpa: resolvedGpa,
      gpaScale: resolvedScale,
      languageScores: cleanedLanguageScores,
      publications: cleanedPublications,
      updatedAt: now,
    }
    const updatedProfile: StudentProfile = {
      ...draftWithUpdatedFields,
      profileCompleteness: calculateProfileCompleteness(draftWithUpdatedFields),
    }

    try {
      const firestorePayload = Object.fromEntries(
        Object.entries(updatedProfile).filter(([, v]) => v !== undefined)
      )
      await saveSplitStudentProfile(user.uid, firestorePayload)
      try {
        await syncUserDirectoryEntry(buildDirectoryEntryFromStudent(updatedProfile))
      } catch (dirErr) {
        console.warn('Could not sync student directory entry:', dirErr)
      }
      if (updatedProfile.fullName) {
        await setDoc(
          doc(db, 'users', user.uid),
          { displayName: updatedProfile.fullName, updatedAt: now },
          { merge: true }
        ).catch(() => {
          // Non-blocking displayName sync
        })
      }
      setProfile(updatedProfile)
      setSavedSnapshot(updatedProfile)
      syncGpaInputsFromProfile(updatedProfile)
      setIsEditing(false)
      if (searchParams.has('edit')) {
        setSearchParams({}, { replace: true })
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Firestore student profile update failed:', err)
      setErrorMsg('Failed to save your profile changes. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // Helper to add research experience item
  const addExperience = () => {
    const newExp: ResearchExperience = {
      id: `exp-${Date.now()}`,
      title: '',
      organization: '',
      role: 'Research Assistant',
      startDate: new Date().toISOString().slice(0, 7),
      isCurrent: true,
      description: '',
    }
    setProfile({
      ...profile,
      researchExperience: [...profile.researchExperience, newExp],
    })
  }

  const removeExperience = (id: string) => {
    if (!window.confirm('Remove this research experience entry?')) return
    setProfile({
      ...profile,
      researchExperience: profile.researchExperience.filter((e) => e.id !== id),
    })
  }

  // Helpers to add, update, and remove publications
  const addPublication = () => {
    const newPub: Publication = {
      id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      conference: '',
      year: new Date().getFullYear(),
      authors: [],
      doi: '',
      url: '',
    }
    setProfile({
      ...profile,
      publications: [...profile.publications, newPub],
    })
  }

  const updatePublication = (index: number, patch: Partial<Publication>) => {
    const updated = [...profile.publications]
    updated[index] = { ...updated[index], ...patch }
    setProfile({ ...profile, publications: updated })
  }

  const removePublication = (id: string) => {
    setProfile({
      ...profile,
      publications: profile.publications.filter((p) => p.id !== id),
    })
  }

  // Helpers to add, update, and remove language/standardized exam scores
  const addLanguageScore = () => {
    const newScore: LanguageScore = {
      id: `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'IELTS',
      score: '',
    }
    setProfile({
      ...profile,
      languageScores: [...profile.languageScores, newScore],
    })
  }

  const updateLanguageScore = (index: number, patch: Partial<LanguageScore>) => {
    const updated = [...profile.languageScores]
    updated[index] = { ...updated[index], ...patch }
    setProfile({ ...profile, languageScores: updated })
  }

  const removeLanguageScore = (id: string) => {
    setProfile({
      ...profile,
      languageScores: profile.languageScores.filter((s) => s.id !== id),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading your academic profile…</p>
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
              onClick={() => navigate('/dashboard/student')}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
                  Academic Profile
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
                  ? 'Update your academic credentials, research topics, exam scores, and CV'
                  : 'Review your academic credentials, research interests, and technical portfolio'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
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
                id="edit-student-profile-btn"
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
                  id="cancel-student-profile-btn"
                >
                  <X size={15} />
                  <span>Cancel</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || uploadingCv}
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
            name={profile.fullName || 'Student'}
            currentPhotoURL={profile.photoURL}
            isEditing={isEditing}
            onPhotoSaved={handlePhotoSaved}
          />
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                {profile.fullName || 'Student Researcher'}
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {profile.degree} Candidate
              </span>
            </div>
            <p className="text-sm font-medium text-slate-600">
              {profile.major || 'Major not set'} •{' '}
              <span className="text-blue-600 font-semibold">
                {profile.university || 'University not set'}
              </span>
            </p>
            <p className="text-xs text-slate-400">{profile.email}</p>

            <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs">
              <div className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/70">
                <span className="text-slate-500 font-medium">Cumulative GPA: </span>
                <strong className="text-slate-900">
                  {profile.gpa > 0 ? `${profile.gpa} / ${profile.gpaScale || 4.0}` : 'Not set'}
                </strong>
              </div>
              <div className="bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/70">
                <span className="text-emerald-700 font-medium">Completeness: </span>
                <strong className="text-emerald-800">{profile.profileCompleteness}%</strong>
              </div>
              {profile.cvUrl && (
                <a
                  href={profile.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100 transition-colors"
                >
                  <FileText size={12} />
                  <span>View Saved CV</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8" id="student-profile-form">
          
          {/* Section 1: Academic Background */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <GraduationCap size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Academic Background</h3>
                <p className="text-xs text-slate-500">Degree, university, GPA, and graduation timeline</p>
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
                  id="profile-fullName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  University / Institution
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.university}
                  onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-university"
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
                  id="profile-department"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Major / Field of Study
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.major}
                  onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-major"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Degree Level
                </label>
                <select
                  disabled={!isEditing}
                  value={profile.degree}
                  onChange={(e) => setProfile({ ...profile, degree: e.target.value as 'Bachelor' | 'Master' | 'PhD' })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-degree"
                >
                  <option value="Bachelor">Bachelor of Science / Arts</option>
                  <option value="Master">Master of Science / Engineering</option>
                  <option value="PhD">Doctor of Philosophy (PhD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Current Year / Semester
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={profile.currentSemester}
                  onChange={(e) => setProfile({ ...profile, currentSemester: e.target.value })}
                  placeholder="e.g. 8th Semester (Senior)"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-semester"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Cumulative GPA / Scale
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isEditing}
                    value={gpaInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setGpaInput(val)
                      }
                    }}
                    placeholder="e.g. 3.85"
                    className="w-2/3 bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="profile-gpa"
                  />
                  <span className="text-slate-400 font-bold">/</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!isEditing}
                    value={gpaScaleInput}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setGpaScaleInput(val)
                      }
                    }}
                    placeholder="4.0"
                    className="w-1/3 bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="profile-gpaScale"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Expected Graduation
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  placeholder="YYYY-MM (e.g. 2027-02)"
                  value={profile.expectedGraduation}
                  onChange={(e) => setProfile({ ...profile, expectedGraduation: e.target.value })}
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-graduation"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Research Focus & Technical Skills */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Research Focus & Technical Skills</h3>
                <p className="text-xs text-slate-500">Keywords used by the match algorithm to score professor opportunities</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <TagInput
                  label="Research Interests & Specific Topics"
                  tags={profile.researchInterests}
                  onChange={(tags) => setProfile((prev) => ({ ...prev, researchInterests: tags }))}
                  placeholder="Type an interest (e.g. Computer Vision, Medical Imaging) and press Enter"
                  disabled={!isEditing}
                />
              </div>

              <div>
                <TagInput
                  label="Broad Research Areas"
                  tags={profile.researchAreas}
                  onChange={(tags) => setProfile((prev) => ({ ...prev, researchAreas: tags }))}
                  placeholder="e.g. Artificial Intelligence, Machine Learning, Robotics"
                  disabled={!isEditing}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <TagInput
                    label="Programming Languages"
                    tags={profile.programmingLanguages}
                    onChange={(tags) => setProfile((prev) => ({ ...prev, programmingLanguages: tags }))}
                    placeholder="e.g. Python, C++, TypeScript"
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <TagInput
                    label="Frameworks & Libraries"
                    tags={profile.frameworks}
                    onChange={(tags) => setProfile((prev) => ({ ...prev, frameworks: tags }))}
                    placeholder="e.g. PyTorch, OpenCV, ROS"
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <TagInput
                    label="Technical Skills & Competencies"
                    tags={profile.technicalSkills}
                    onChange={(tags) => setProfile((prev) => ({ ...prev, technicalSkills: tags }))}
                    placeholder="e.g. Image Segmentation, CUDA, SLAM"
                    disabled={!isEditing}
                  />
                </div>

                <div>
                  <TagInput
                    label="Research Tools & Lab Methods"
                    tags={profile.researchTools}
                    onChange={(tags) => setProfile((prev) => ({ ...prev, researchTools: tags }))}
                    placeholder="e.g. LaTeX, Docker, Linux, Git"
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Research Experience & Projects */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Cpu size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Research Experience & Projects</h3>
                  <p className="text-xs text-slate-500">Hands-on lab appointments and technical repositories</p>
                </div>
              </div>

              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addExperience}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Plus size={13} />
                  <span>Add Experience</span>
                </Button>
              )}
            </div>

            {profile.researchExperience.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No research experience entries added yet.
              </p>
            ) : (
              <div className="space-y-4">
                {profile.researchExperience.map((exp, index) => (
                  <div
                    key={exp.id}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={exp.title}
                          onChange={(e) => {
                            const updated = [...profile.researchExperience]
                            updated[index] = { ...updated[index], title: e.target.value }
                            setProfile({ ...profile, researchExperience: updated })
                          }}
                          placeholder="Position Title"
                          className="bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                        />
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={exp.organization}
                          onChange={(e) => {
                            const updated = [...profile.researchExperience]
                            updated[index] = { ...updated[index], organization: e.target.value }
                            setProfile({ ...profile, researchExperience: updated })
                          }}
                          placeholder="Lab or Organization"
                          className="bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                        />
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeExperience(exp.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                          title="Remove Experience"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      disabled={!isEditing}
                      value={exp.description}
                      onChange={(e) => {
                        const updated = [...profile.researchExperience]
                        updated[index] = { ...updated[index], description: e.target.value }
                        setProfile({ ...profile, researchExperience: updated })
                      }}
                      placeholder="Description of duties, findings, and publications…"
                      className="w-full bg-white disabled:bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Publications & Language / Standardized Exams */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    Publications & Standardized Exams
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official language & standardized test scores (IELTS, TOEFL, TOPIK, GRE, GMAT) and papers
                  </p>
                </div>
              </div>

              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLanguageScore}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  id="add-exam-score-btn"
                >
                  <Plus size={13} />
                  <span>Add Exam Score</span>
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2.5">
                  Language & Standardized Exam Scores
                </label>

                {profile.languageScores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1">
                    {isEditing
                      ? 'Click "Add Exam Score" to add IELTS, TOEFL, TOPIK, GRE, GMAT, or other exam results.'
                      : 'No language or standardized exam scores recorded.'}
                  </p>
                ) : isEditing ? (
                  <div className="space-y-2.5">
                    {profile.languageScores.map((score, idx) => (
                      <div
                        key={score.id}
                        className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-2.5"
                      >
                        <select
                          value={score.type}
                          onChange={(e) =>
                            updateLanguageScore(idx, {
                              type: e.target.value as LanguageScore['type'],
                            })
                          }
                          className="sm:w-44 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-600 outline-none"
                        >
                          {EXAM_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={score.score}
                          onChange={(e) => updateLanguageScore(idx, { score: e.target.value })}
                          placeholder="Score / Level (e.g. 7.5, 108, Level 5, 324)"
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => removeLanguageScore(score.id)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors self-end sm:self-center cursor-pointer"
                          title="Remove Exam Score"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.languageScores.map((score) => (
                      <div
                        key={score.id}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between"
                      >
                        <span className="text-xs font-bold text-slate-800">{score.type}</span>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                          {score.score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Conference & Journal Papers
                  </label>
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPublication}
                      className="flex items-center gap-1 text-xs font-semibold"
                      id="add-publication-btn"
                    >
                      <Plus size={13} />
                      <span>Add Publication</span>
                    </Button>
                  )}
                </div>

                {profile.publications.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    {isEditing
                      ? 'Click "Add Publication" to add conference or journal papers.'
                      : 'No publications added yet.'}
                  </p>
                ) : isEditing ? (
                  <div className="space-y-3">
                    {profile.publications.map((pub, index) => (
                      <div
                        key={pub.id}
                        className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                            <input
                              type="text"
                              value={pub.title}
                              onChange={(e) => updatePublication(index, { title: e.target.value })}
                              placeholder="Paper Title"
                              className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-blue-600 outline-none"
                            />
                            <input
                              type="text"
                              value={pub.conference || pub.journal || ''}
                              onChange={(e) => updatePublication(index, { conference: e.target.value })}
                              placeholder="Venue (Conference / Journal)"
                              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 outline-none"
                            />
                            <input
                              type="number"
                              value={pub.year || ''}
                              onChange={(e) =>
                                updatePublication(index, {
                                  year: Number(e.target.value) || new Date().getFullYear(),
                                })
                              }
                              placeholder="Year (e.g. 2026)"
                              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 outline-none"
                            />
                            <input
                              type="text"
                              value={(pub.authors || []).join(', ')}
                              onChange={(e) =>
                                updatePublication(index, {
                                  authors: e.target.value
                                    .split(',')
                                    .map((a) => a.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="Authors (comma-separated)"
                              className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 outline-none"
                            />
                            <input
                              type="text"
                              value={pub.doi || ''}
                              onChange={(e) => updatePublication(index, { doi: e.target.value })}
                              placeholder="DOI (optional)"
                              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 outline-none"
                            />
                            <input
                              type="url"
                              value={pub.url || ''}
                              onChange={(e) => updatePublication(index, { url: e.target.value })}
                              placeholder="Paper URL (optional)"
                              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePublication(pub.id)}
                            className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                            title="Remove Publication"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {profile.publications.map((pub) => (
                      <div
                        key={pub.id}
                        className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{pub.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {pub.conference || pub.journal} ({pub.year})
                            {pub.authors && pub.authors.length > 0 ? ` • Authors: ${pub.authors.join(', ')}` : ''}
                          </p>
                          {pub.doi && (
                            <p className="text-[10px] text-blue-600 font-mono mt-0.5">DOI: {pub.doi}</p>
                          )}
                        </div>
                        {pub.url && (
                          <a
                            href={pub.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: Documents & Web Presence */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">CV & Web Presence</h3>
                <p className="text-xs text-slate-500">
                  Manage your Curriculum Vitae (automatically pre-filled when applying) and online portfolio
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Curriculum Vitae (CV) URL or File Upload
                  </label>
                  {isEditing && (
                    <>
                      <input
                        ref={cvFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleCvUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={uploadingCv}
                        onClick={() => cvFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        <Upload size={13} />
                        <span>{uploadingCv ? 'Uploading CV…' : 'Upload PDF/DOCX File'}</span>
                      </button>
                    </>
                  )}
                </div>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.cvUrl || ''}
                  onChange={(e) => {
                    setCvUploadSuccess(false)
                    setProfile({ ...profile, cvUrl: e.target.value })
                  }}
                  placeholder="https://example.com/cv.pdf"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-cvUrl"
                />
                {cvUploadSuccess && (
                  <p className="text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                    <Check size={13} />
                    <span>CV uploaded successfully. Click "Save Changes" to persist it to your profile.</span>
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Personal Website / GitHub Profile
                </label>
                <input
                  type="url"
                  disabled={!isEditing}
                  value={profile.portfolioUrl || ''}
                  onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-600 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-portfolioUrl"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer (Visible only in Edit Mode) */}
          {isEditing && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertCircle size={14} className="text-blue-600" />
                <span>Changes are saved directly to your Scholivo account.</span>
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
                  disabled={saving || uploadingCv}
                  className="flex items-center justify-center gap-2 px-8 py-3 flex-1 sm:flex-initial shadow-xs"
                  id="save-profile-bottom-btn"
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving Changes…' : 'Save Profile'}</span>
                </Button>
              </div>
            </div>
          )}

        </form>

      </div>
    </div>
  )
}
