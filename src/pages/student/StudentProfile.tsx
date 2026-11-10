import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { 
  GraduationCap, BookOpen, Cpu, 
  Save, Check, Award, FileText, ArrowLeft, Plus, Trash2,
  ExternalLink, AlertCircle
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ResearchExperience } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { Avatar } from '@/components/common/Avatar'

import { calculateProfileCompleteness } from '@/utils/helpers'

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
    verificationStatus: 'pending',
    accountStatus: 'active',
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

function normalizeStudentProfile(raw: Partial<StudentProfile>, uid: string, email: string, displayName: string, photoURL?: string): StudentProfile {
  const base = createEmptyStudentProfile(uid, email, displayName, photoURL)
  const merged: StudentProfile = {
    ...base,
    ...raw,
    uid: raw.uid || uid,
    email: raw.email || email,
    fullName: raw.fullName ?? displayName,
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
  const [profile, setProfile] = useState<StudentProfile>(() =>
    createEmptyStudentProfile(user?.uid || '', user?.email || '', user?.displayName || '', user?.photoURL || undefined)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'students', user.uid))
        if (!isMounted) return
        if (snap.exists()) {
          const remote = snap.data() as Partial<StudentProfile>
          setProfile(
            normalizeStudentProfile(
              remote,
              user.uid,
              user.email || '',
              user.displayName || '',
              user.photoURL || undefined
            )
          )
        } else {
          setProfile(
            createEmptyStudentProfile(
              user.uid,
              user.email || '',
              user.displayName || '',
              user.photoURL || undefined
            )
          )
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setErrorMsg(null)

    const now = new Date().toISOString()
    const updatedProfile: StudentProfile = {
      ...profile,
      uid: user.uid,
      email: profile.email || user.email || '',
      profileCompleteness: calculateProfileCompleteness(profile),
      updatedAt: now,
    }

    try {
      const firestorePayload = Object.fromEntries(
        Object.entries(updatedProfile).filter(([, v]) => v !== undefined)
      )
      await setDoc(doc(db, 'students', user.uid), firestorePayload, { merge: true })
      if (updatedProfile.fullName) {
        await setDoc(
          doc(db, 'users', user.uid),
          { displayName: updatedProfile.fullName, updatedAt: now },
          { merge: true }
        )
      }
      setProfile(updatedProfile)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      console.error('Firestore student profile update failed:', err)
      setErrorMsg('Failed to save your profile changes. Please try again.')
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
    setProfile({
      ...profile,
      researchExperience: profile.researchExperience.filter((e) => e.id !== id),
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

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Profile Card Summary Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar src={profile.photoURL} name={profile.fullName || 'Student'} size="xl" />
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
              {profile.major || 'Major not set'} • <span className="text-blue-600 font-semibold">{profile.university || 'University not set'}</span>
            </p>
            <p className="text-xs text-slate-400">{profile.email}</p>

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
                  placeholder="e.g. 8th Semester (Senior)"
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
            </div>

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
                        value={exp.title}
                        onChange={(e) => {
                          const updated = [...profile.researchExperience]
                          updated[index].title = e.target.value
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
                          updated[index].organization = e.target.value
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
                      updated[index].description = e.target.value
                      setProfile({ ...profile, researchExperience: updated })
                    }}
                    placeholder="Description of duties, findings, and publications…"
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
              {profile.publications.map((pub) => (
                <div key={pub.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{pub.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {pub.conference || pub.journal} ({pub.year}) • Authors: {pub.authors.join(', ')}
                    </p>
                    {pub.doi && <p className="text-[10px] text-blue-600 font-mono mt-0.5">DOI: {pub.doi}</p>}
                  </div>
                  {pub.url && (
                    <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Language & Exam Scores
                </label>
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
                <p className="text-xs text-slate-500">Provide verified links to your CV, transcript, and online portfolio</p>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertCircle size={14} className="text-blue-600" />
              <span>Changes are saved directly to your Scholivo account.</span>
            </div>

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
