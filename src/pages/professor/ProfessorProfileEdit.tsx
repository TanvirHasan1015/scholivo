import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore'
import { 
  GraduationCap, BookOpen, Globe, Save, Check, 
  ArrowLeft, Plus, Trash2, AlertCircle, 
  Building, Users, Eye, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { ProfessorProfile, ResearchProject, Publication, RecruitingStatus } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { Avatar } from '@/components/common/Avatar'
import { COUNTRIES } from '@/utils/helpers'

function normalizeProfessorProfile(raw: Partial<ProfessorProfile>, fallbackUid: string): ProfessorProfile {
  return {
    uid: raw.uid || fallbackUid,
    fullName: raw.fullName ?? '',
    username: raw.username ?? '',
    email: raw.email ?? '',
    academicTitle: raw.academicTitle ?? '',
    country: raw.country ?? '',
    university: raw.university ?? '',
    department: raw.department ?? '',
    faculty: raw.faculty ?? '',
    photoURL: raw.photoURL,
    universityProfileUrl: raw.universityProfileUrl ?? '',
    googleScholarUrl: raw.googleScholarUrl ?? '',
    orcid: raw.orcid ?? '',
    personalWebpageUrl: raw.personalWebpageUrl ?? '',
    biography: raw.biography ?? '',
    researchAreas: Array.isArray(raw.researchAreas) ? raw.researchAreas : [],
    researchInterests: Array.isArray(raw.researchInterests) ? raw.researchInterests : [],
    currentProjects: Array.isArray(raw.currentProjects) ? raw.currentProjects : [],
    publications: Array.isArray(raw.publications) ? raw.publications : [],
    labName: raw.labName ?? '',
    labDescription: raw.labDescription ?? '',
    labWebsiteUrl: raw.labWebsiteUrl ?? '',
    labMembers: Array.isArray(raw.labMembers) ? raw.labMembers : [],
    accountStatus: raw.accountStatus ?? 'active',
    isRecruiting: Boolean(raw.isRecruiting),
    recruitingStatus: raw.recruitingStatus ?? 'not_recruiting',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  }
}

export default function ProfessorProfileEdit() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfessorProfile | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    setNotFound(false)

    try {
      const directSnap = await getDoc(doc(db, 'professors', user.uid))
      if (directSnap.exists()) {
        setDocId(directSnap.id)
        setProfile(normalizeProfessorProfile(directSnap.data() as Partial<ProfessorProfile>, user.uid))
        setLoading(false)
        return
      }

      const fallbackSnap = await getDocs(
        query(collection(db, 'professors'), where('uid', '==', user.uid), limit(1))
      )
      if (!fallbackSnap.empty) {
        const matchDoc = fallbackSnap.docs[0]
        setDocId(matchDoc.id)
        setProfile(normalizeProfessorProfile(matchDoc.data() as Partial<ProfessorProfile>, user.uid))
        setLoading(false)
        return
      }

      setProfile(null)
      setDocId(null)
      setNotFound(true)
    } catch (err) {
      console.error('Error loading professor profile:', err)
      setLoadError('Failed to load your faculty profile from Firebase. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile || !docId || notFound || loadError) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const nowIso = new Date().toISOString()
    const editableFields = {
      fullName: profile.fullName.trim(),
      academicTitle: profile.academicTitle.trim(),
      university: profile.university.trim(),
      department: profile.department.trim(),
      country: profile.country,
      recruitingStatus: profile.recruitingStatus,
      isRecruiting: profile.isRecruiting,
      biography: profile.biography.trim(),
      researchAreas: profile.researchAreas,
      researchInterests: profile.researchInterests,
      labName: (profile.labName || '').trim(),
      labWebsiteUrl: (profile.labWebsiteUrl || '').trim(),
      labDescription: (profile.labDescription || '').trim(),
      currentProjects: profile.currentProjects || [],
      publications: profile.publications || [],
      universityProfileUrl: (profile.universityProfileUrl || '').trim(),
      googleScholarUrl: (profile.googleScholarUrl || '').trim(),
      orcid: (profile.orcid || '').trim(),
      personalWebpageUrl: (profile.personalWebpageUrl || '').trim(),
      updatedAt: nowIso,
    }

    try {
      await updateDoc(doc(db, 'professors', docId), editableFields)
      setProfile({
        ...profile,
        ...editableFields,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Firestore update error:', err)
      setSaveError('Failed to save faculty profile changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addProject = () => {
    if (!profile) return
    const newProj: ResearchProject = {
      id: `proj-${Date.now()}`,
      title: '',
      description: '',
      fundingSource: '',
      isOngoing: true,
      startDate: '',
    }
    setProfile({
      ...profile,
      currentProjects: [...(profile.currentProjects || []), newProj],
    })
  }

  const removeProject = (id: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      currentProjects: (profile.currentProjects || []).filter((p) => p.id !== id),
    })
  }

  const addPublication = () => {
    if (!profile) return
    const newPub: Publication = {
      id: `pub-${Date.now()}`,
      title: '',
      journal: '',
      year: new Date().getFullYear(),
      authors: profile.fullName ? [profile.fullName] : [],
    }
    setProfile({
      ...profile,
      publications: [...(profile.publications || []), newPub],
    })
  }

  const removePublication = (id: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      publications: (profile.publications || []).filter((p) => p.id !== id),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading your faculty profile…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-16 pb-20 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Unable to Load Faculty Profile</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/professor')}>
              Back to Dashboard
            </Button>
            <Button size="sm" onClick={loadData} className="flex items-center gap-1.5">
              <RefreshCw size={14} />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-16 pb-20 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Building size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Faculty Profile Not Found</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            No professor profile document was found in Firestore for your account ({user?.email}).
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/professor')}>
              Back to Dashboard
            </Button>
          </div>
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
                  Faculty Profile & Lab Settings
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Update your academic appointments, ongoing grants, publications, and recruitment status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile.username && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/professor/${profile.username}`)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                id="view-public-profile-btn"
              >
                <Eye size={14} />
                <span>Public Profile</span>
              </Button>
            )}

            {saveSuccess && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 animate-fade-in">
                <Check size={14} className="text-emerald-600" />
                <span>Profile Saved</span>
              </span>
            )}

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
          </div>
        </div>

        {saveError && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Profile Card Summary Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar src={profile.photoURL} name={profile.fullName || user?.displayName || 'Professor'} size="xl" className="ring-4 ring-slate-100" />
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                {profile.fullName || user?.displayName || 'Professor'}
              </h2>
            </div>
            <p className="text-sm font-semibold text-blue-600">
              {profile.academicTitle || 'Faculty'} • {profile.department || 'Department not set'}
            </p>
            <p className="text-xs text-slate-500">{profile.university || 'University not set'}{profile.country ? `, ${profile.country}` : ''}</p>
            <p className="text-xs text-slate-400">{profile.email || user?.email}</p>
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
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-fullName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Academic Title / Position
                </label>
                <input
                  type="text"
                  value={profile.academicTitle}
                  onChange={(e) => setProfile({ ...profile, academicTitle: e.target.value })}
                  placeholder="e.g. Associate Professor, Chair Professor"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-academicTitle"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  University / Institute
                </label>
                <input
                  type="text"
                  value={profile.university}
                  onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-university"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Department / School
                </label>
                <input
                  type="text"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-department"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <select
                  value={profile.country}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-country"
                >
                  <option value="">Select Country</option>
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
                  value={profile.recruitingStatus}
                  onChange={(e) => {
                    const status = e.target.value as RecruitingStatus
                    setProfile({
                      ...profile,
                      recruitingStatus: status,
                      isRecruiting: status === 'actively_recruiting',
                    })
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                  value={profile.biography}
                  onChange={(e) => setProfile({ ...profile, biography: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                  onChange={(tags) => setProfile({ ...profile, researchAreas: tags })}
                  placeholder="e.g. Computer Vision, Medical AI, Deep Learning"
                />
              </div>

              <div>
                <TagInput
                  label="Specific Research Topics & Methodologies"
                  tags={profile.researchInterests}
                  onChange={(tags) => setProfile({ ...profile, researchInterests: tags })}
                  placeholder="e.g. Diffusion Models, Image Segmentation, 3D Vision"
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
                  value={profile.labName || ''}
                  onChange={(e) => setProfile({ ...profile, labName: e.target.value })}
                  placeholder="e.g. Visual Intelligence & Medical AI Lab"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Lab Website URL
                </label>
                <input
                  type="url"
                  value={profile.labWebsiteUrl || ''}
                  onChange={(e) => setProfile({ ...profile, labWebsiteUrl: e.target.value })}
                  placeholder="https://lab.university.edu"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labUrl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Lab Description & Culture
                </label>
                <textarea
                  rows={3}
                  value={profile.labDescription || ''}
                  onChange={(e) => setProfile({ ...profile, labDescription: e.target.value })}
                  placeholder="Describe your research environment, group members, compute resources, and lab culture…"
                  className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-labDesc"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Current Funded Projects & Publications */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Funded Projects & Publications</h3>
                  <p className="text-xs text-slate-500">Active research programs and selected publications</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPublication}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  id="add-publication-btn"
                >
                  <Plus size={13} />
                  <span>Add Publication</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {(profile.currentProjects || []).length === 0 && (profile.publications || []).length === 0 && (
                <p className="text-xs text-slate-400 italic">No projects or publications added yet.</p>
              )}

              {(profile.currentProjects || []).map((project, index) => (
                <div
                  key={project.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <input
                        type="text"
                        value={project.title}
                        onChange={(e) => {
                          const updated = [...(profile.currentProjects || [])]
                          updated[index] = { ...updated[index], title: e.target.value }
                          setProfile({ ...profile, currentProjects: updated })
                        }}
                        placeholder="Project Title"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                      />
                      <input
                        type="text"
                        value={project.fundingSource || ''}
                        onChange={(e) => {
                          const updated = [...(profile.currentProjects || [])]
                          updated[index] = { ...updated[index], fundingSource: e.target.value }
                          setProfile({ ...profile, currentProjects: updated })
                        }}
                        placeholder="Funding Agency (e.g. NRF, NSF, Industry)"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProject(project.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      title="Remove Project"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={project.description}
                    onChange={(e) => {
                      const updated = [...(profile.currentProjects || [])]
                      updated[index] = { ...updated[index], description: e.target.value }
                      setProfile({ ...profile, currentProjects: updated })
                    }}
                    placeholder="Brief description of objectives and student roles…"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              ))}

              {(profile.publications || []).map((pub, index) => (
                <div
                  key={pub.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <input
                        type="text"
                        value={pub.title}
                        onChange={(e) => {
                          const updated = [...(profile.publications || [])]
                          updated[index] = { ...updated[index], title: e.target.value }
                          setProfile({ ...profile, publications: updated })
                        }}
                        placeholder="Publication Title"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                      />
                      <input
                        type="text"
                        value={pub.journal || pub.conference || ''}
                        onChange={(e) => {
                          const updated = [...(profile.publications || [])]
                          updated[index] = { ...updated[index], journal: e.target.value }
                          setProfile({ ...profile, publications: updated })
                        }}
                        placeholder="Journal or Conference Venue"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePublication(pub.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      title="Remove Publication"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                  value={profile.universityProfileUrl || ''}
                  onChange={(e) => setProfile({ ...profile, universityProfileUrl: e.target.value })}
                  placeholder="https://cs.university.edu/~prof"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-facultyUrl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Google Scholar URL
                </label>
                <input
                  type="url"
                  value={profile.googleScholarUrl || ''}
                  onChange={(e) => setProfile({ ...profile, googleScholarUrl: e.target.value })}
                  placeholder="https://scholar.google.com/citations?user=..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-scholarUrl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  ORCID Identifier
                </label>
                <input
                  type="text"
                  value={profile.orcid || ''}
                  onChange={(e) => setProfile({ ...profile, orcid: e.target.value })}
                  placeholder="0000-0002-1825-0097"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-orcid"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Personal / Lab Website
                </label>
                <input
                  type="url"
                  value={profile.personalWebpageUrl || ''}
                  onChange={(e) => setProfile({ ...profile, personalWebpageUrl: e.target.value })}
                  placeholder="https://cvlab.university.edu"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="prof-webpageUrl"
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 w-full sm:w-auto shadow-xs"
              id="save-profile-bottom-btn"
            >
              <Save size={16} />
              <span>{saving ? 'Saving Changes…' : 'Save Faculty Profile'}</span>
            </Button>
          </div>

        </form>

      </div>
    </div>
  )
}
