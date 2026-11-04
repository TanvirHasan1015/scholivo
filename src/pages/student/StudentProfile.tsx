import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore'
import { 
  GraduationCap, BookOpen, Cpu, 
  Save, Check, Award, FileText, ArrowLeft, Plus, Trash2,
  ExternalLink, AlertCircle, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ResearchExperience, Project } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { Avatar } from '@/components/common/Avatar'
import { calculateProfileCompleteness } from '@/utils/helpers'

function normalizeStudentProfile(raw: Partial<StudentProfile>, fallbackUid: string): StudentProfile {
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

export default function StudentProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    setNotFound(false)

    try {
      const directSnap = await getDoc(doc(db, 'students', user.uid))
      if (directSnap.exists()) {
        setDocId(directSnap.id)
        setProfile(normalizeStudentProfile(directSnap.data() as Partial<StudentProfile>, user.uid))
        setLoading(false)
        return
      }

      const fallbackSnap = await getDocs(
        query(collection(db, 'students'), where('uid', '==', user.uid), limit(1))
      )
      if (!fallbackSnap.empty) {
        const matchDoc = fallbackSnap.docs[0]
        setDocId(matchDoc.id)
        setProfile(normalizeStudentProfile(matchDoc.data() as Partial<StudentProfile>, user.uid))
        setLoading(false)
        return
      }

      setProfile(null)
      setDocId(null)
      setNotFound(true)
    } catch (err) {
      console.error('Error loading student profile:', err)
      setLoadError('Failed to load your academic profile from Firebase. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile || !docId || notFound || loadError) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    const completeness = calculateProfileCompleteness(profile)
    const nowIso = new Date().toISOString()

    const editableFields = {
      fullName: profile.fullName.trim(),
      university: profile.university.trim(),
      department: profile.department.trim(),
      major: profile.major.trim(),
      degree: profile.degree,
      currentSemester: profile.currentSemester.trim(),
      expectedGraduation: profile.expectedGraduation.trim(),
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      researchInterests: profile.researchInterests,
      researchAreas: profile.researchAreas,
      programmingLanguages: profile.programmingLanguages,
      frameworks: profile.frameworks,
      technicalSkills: profile.technicalSkills,
      researchTools: profile.researchTools,
      researchExperience: profile.researchExperience,
      projects: profile.projects,
      publications: profile.publications,
      languageScores: profile.languageScores,
      cvUrl: profile.cvUrl || '',
      transcriptUrl: profile.transcriptUrl || '',
      portfolioUrl: profile.portfolioUrl || '',
      bio: profile.bio || '',
      profileCompleteness: completeness,
      updatedAt: nowIso,
    }

    try {
      await updateDoc(doc(db, 'students', docId), editableFields)
      setProfile({
        ...profile,
        ...editableFields,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Firestore update failed:', err)
      setSaveError('Failed to save profile changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addExperience = () => {
    if (!profile) return
    const newExp: ResearchExperience = {
      id: `exp-${Date.now()}`,
      title: '',
      organization: '',
      role: '',
      startDate: '',
      isCurrent: true,
      description: '',
    }
    setProfile({
      ...profile,
      researchExperience: [...profile.researchExperience, newExp],
    })
  }

  const removeExperience = (id: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      researchExperience: profile.researchExperience.filter((e) => e.id !== id),
    })
  }

  const addProject = () => {
    if (!profile) return
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      title: '',
      description: '',
      url: '',
      technologies: [],
    }
    setProfile({
      ...profile,
      projects: [...profile.projects, newProj],
    })
  }

  const removeProject = (id: string) => {
    if (!profile) return
    setProfile({
      ...profile,
      projects: profile.projects.filter((p) => p.id !== id),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-600 animate-pulse" />
          <p className="text-xs font-medium text-slate-500">Loading your academic profile…</p>
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
          <h1 className="text-xl font-bold font-display text-slate-900">Unable to Load Profile</h1>
          <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/student')}>
              Back to Dashboard
            </Button>
            <Button size="sm" onClick={loadProfile} className="flex items-center gap-1.5">
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
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">Student Profile Not Found</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            No student profile document was found in Firestore for your account ({user?.email}).
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/student')}>
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
              onClick={() => navigate('/dashboard/student')}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title="Back to Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
                Academic Profile
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Keep your credentials, research interests, and project portfolio up to date
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          <Avatar src={profile.photoURL} name={profile.fullName || user?.displayName || 'Student'} size="xl" />
          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                {profile.fullName || user?.displayName || 'Student'}
              </h2>
              {profile.degree && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {profile.degree} Candidate
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-600">
              {profile.major || 'Major not set'} • <span className="text-blue-600 font-semibold">{profile.university || 'University not set'}</span>
            </p>
            <p className="text-xs text-slate-400">{profile.email || user?.email}</p>

            <div className="pt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs">
              <div className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/70">
                <span className="text-slate-500 font-medium">Cumulative GPA: </span>
                <strong className="text-slate-900">{profile.gpa} / {profile.gpaScale}</strong>
              </div>
              <div className="bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/70">
                <span className="text-emerald-700 font-medium">Completeness: </span>
                <strong className="text-emerald-800">{profile.profileCompleteness}%</strong>
              </div>
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
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-fullName"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  University / Institution
                </label>
                <input
                  type="text"
                  value={profile.university}
                  onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-university"
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
                  id="profile-department"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Major / Field of Study
                </label>
                <input
                  type="text"
                  value={profile.major}
                  onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-major"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Degree Level
                </label>
                <select
                  value={profile.degree}
                  onChange={(e) => setProfile({ ...profile, degree: e.target.value as 'Bachelor' | 'Master' | 'PhD' })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                  value={profile.currentSemester}
                  onChange={(e) => setProfile({ ...profile, currentSemester: e.target.value })}
                  placeholder="e.g. 4th Semester"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-semester"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Cumulative GPA / Scale
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={profile.gpa}
                    onChange={(e) => setProfile({ ...profile, gpa: parseFloat(e.target.value) || 0 })}
                    className="w-2/3 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="profile-gpa"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={profile.gpaScale}
                    onChange={(e) => setProfile({ ...profile, gpaScale: parseFloat(e.target.value) || 4.0 })}
                    className="w-1/3 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                  placeholder="YYYY-MM (e.g. 2027-02)"
                  value={profile.expectedGraduation}
                  onChange={(e) => setProfile({ ...profile, expectedGraduation: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                  label="Research Interests & Topics"
                  tags={profile.researchInterests}
                  onChange={(tags) => setProfile({ ...profile, researchInterests: tags })}
                  placeholder="Type an interest (e.g. Computer Vision, Medical Imaging) and press Enter"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <TagInput
                    label="Programming Languages"
                    tags={profile.programmingLanguages}
                    onChange={(tags) => setProfile({ ...profile, programmingLanguages: tags })}
                    placeholder="e.g. Python, C++, TypeScript"
                  />
                </div>

                <div>
                  <TagInput
                    label="Frameworks & Libraries"
                    tags={profile.frameworks}
                    onChange={(tags) => setProfile({ ...profile, frameworks: tags })}
                    placeholder="e.g. PyTorch, OpenCV, ROS"
                  />
                </div>
              </div>

              <div>
                <TagInput
                  label="Technical Skills & Competencies"
                  tags={profile.technicalSkills}
                  onChange={(tags) => setProfile({ ...profile, technicalSkills: tags })}
                  placeholder="e.g. Image Segmentation, CUDA, SLAM"
                />
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

              <div className="flex items-center gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProject}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Plus size={13} />
                  <span>Add Project</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {profile.researchExperience.length === 0 && profile.projects.length === 0 && (
                <p className="text-xs text-slate-400 italic">No research experience or projects added yet.</p>
              )}
              {profile.researchExperience.map((exp, index) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => {
                          const updated = [...profile.researchExperience]
                          updated[index] = { ...updated[index], title: e.target.value }
                          setProfile({ ...profile, researchExperience: updated })
                        }}
                        placeholder="Position Title"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                      />
                      <input
                        type="text"
                        value={exp.organization}
                        onChange={(e) => {
                          const updated = [...profile.researchExperience]
                          updated[index] = { ...updated[index], organization: e.target.value }
                          setProfile({ ...profile, researchExperience: updated })
                        }}
                        placeholder="Lab or Organization"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExperience(exp.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => {
                      const updated = [...profile.researchExperience]
                      updated[index] = { ...updated[index], description: e.target.value }
                      setProfile({ ...profile, researchExperience: updated })
                    }}
                    placeholder="Description of duties, findings, and publications…"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              ))}

              {profile.projects.map((proj, index) => (
                <div
                  key={proj.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                      <input
                        type="text"
                        value={proj.title}
                        onChange={(e) => {
                          const updated = [...profile.projects]
                          updated[index] = { ...updated[index], title: e.target.value }
                          setProfile({ ...profile, projects: updated })
                        }}
                        placeholder="Project Title"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900"
                      />
                      <input
                        type="url"
                        value={proj.url || ''}
                        onChange={(e) => {
                          const updated = [...profile.projects]
                          updated[index] = { ...updated[index], url: e.target.value }
                          setProfile({ ...profile, projects: updated })
                        }}
                        placeholder="Project / Repository URL"
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProject(proj.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Remove Project"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={proj.description}
                    onChange={(e) => {
                      const updated = [...profile.projects]
                      updated[index] = { ...updated[index], description: e.target.value }
                      setProfile({ ...profile, projects: updated })
                    }}
                    placeholder="Project description and key technical contributions…"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 outline-none focus:border-blue-600 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Publications & Language Exams */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">Publications & Standardized Exams</h3>
                <p className="text-xs text-slate-500">Peer-reviewed manuscripts and official language certifications</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Conference & Journal Papers
              </label>
              {profile.publications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No publications listed yet.</p>
              ) : (
                profile.publications.map((pub) => (
                  <div key={pub.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{pub.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {pub.conference || pub.journal} ({pub.year}) • Authors: {(pub.authors || []).join(', ')}
                      </p>
                      {pub.doi && <p className="text-[10px] text-blue-600 font-mono mt-0.5">DOI: {pub.doi}</p>}
                    </div>
                    {pub.url && (
                      <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))
              )}

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Language & Exam Scores
                </label>
                {profile.languageScores.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No language scores listed yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profile.languageScores.map((score) => (
                      <div key={score.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{score.type}</span>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {score.score}
                        </span>
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
                <h3 className="text-base font-bold text-slate-900 font-display">Documents & External Links</h3>
                <p className="text-xs text-slate-500">Provide links to your CV, transcript, and online portfolio</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  CV / Resume URL
                </label>
                <input
                  type="url"
                  value={profile.cvUrl || ''}
                  onChange={(e) => setProfile({ ...profile, cvUrl: e.target.value })}
                  placeholder="https://example.com/cv.pdf"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-cvUrl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Academic Transcript URL
                </label>
                <input
                  type="url"
                  value={profile.transcriptUrl || ''}
                  onChange={(e) => setProfile({ ...profile, transcriptUrl: e.target.value })}
                  placeholder="https://example.com/transcript.pdf"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-transcriptUrl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Personal Website / GitHub Profile
                </label>
                <input
                  type="url"
                  value={profile.portfolioUrl || ''}
                  onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  id="profile-portfolioUrl"
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
              <span>{saving ? 'Saving Changes…' : 'Save Profile'}</span>
            </Button>
          </div>

        </form>

      </div>
    </div>
  )
}
