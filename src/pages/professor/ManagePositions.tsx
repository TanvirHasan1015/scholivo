import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { 
  Plus, ArrowLeft, Trash2, Calendar, DollarSign, Check, 
  AlertCircle, Edit3, X, Briefcase
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import type { Position, DegreeType, FundingType } from '@/types/position.types'
import type { ProfessorProfile } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { RESEARCH_AREAS, FUNDING_LABELS, formatDate } from '@/utils/helpers'

export default function ManagePositions() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [positions, setPositions] = useState<Position[]>([])
  const [professorProfile, setProfessorProfile] = useState<ProfessorProfile | null>(null)
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Editing or creating modal/panel state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Form inputs
  const [title, setTitle] = useState('')
  const [degreeType, setDegreeType] = useState<DegreeType>('PhD')
  const [researchArea, setResearchArea] = useState('Computer Vision')
  const [description, setDescription] = useState('')
  const [researchTopics, setResearchTopics] = useState<string[]>([])
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [preferredSkills, setPreferredSkills] = useState<string[]>([])
  const [minimumGPA, setMinimumGPA] = useState('3.5')
  const [fundingType, setFundingType] = useState<FundingType>('fully_funded')
  const [stipend, setStipend] = useState('')
  const [applicationDeadline, setApplicationDeadline] = useState('')
  const [startDate, setStartDate] = useState('Spring 2027')

  const [verificationStatus, setVerificationStatus] = useState<string>('pending')

  useEffect(() => {
    let isMounted = true

    async function loadManagePositionsData() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const [profSnap, posSnap, appSnap] = await Promise.all([
          getDoc(doc(db, 'professors', user.uid)),
          getDocs(query(collection(db, 'positions'), where('professorId', '==', user.uid))),
          getDocs(query(collection(db, 'applications'), where('professorId', '==', user.uid))),
        ])

        if (!isMounted) return

        if (profSnap.exists()) {
          const profData = profSnap.data() as ProfessorProfile
          setProfessorProfile(profData)
          setVerificationStatus(profData.verificationStatus || 'pending')
        } else {
          setVerificationStatus('pending')
        }

        const loadedPositions: Position[] = posSnap.docs
          .map((d) => ({
            ...(d.data() as Position),
            id: d.id,
          }))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        setPositions(loadedPositions)

        const counts: Record<string, number> = {}
        appSnap.docs.forEach((d) => {
          const posId = (d.data() as { positionId?: string }).positionId
          if (posId) {
            counts[posId] = (counts[posId] || 0) + 1
          }
        })
        setApplicantCounts(counts)
        setErrorMsg(null)
      } catch (err) {
        console.error('Failed to load professor positions from Firestore:', err)
        if (isMounted) {
          setErrorMsg('Failed to load your research opportunities from the server. Please refresh and try again.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadManagePositionsData()
    return () => {
      isMounted = false
    }
  }, [user])

  const openCreateForm = () => {
    setEditingPositionId(null)
    setTitle('')
    setDegreeType('PhD')
    setResearchArea(professorProfile?.researchAreas?.[0] || 'Computer Vision')
    setDescription('')
    setResearchTopics([])
    setRequiredSkills([])
    setPreferredSkills([])
    setMinimumGPA('3.5')
    setFundingType('fully_funded')
    setStipend('')
    setApplicationDeadline('')
    setStartDate('Spring 2027')
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const openEditForm = (pos: Position) => {
    setEditingPositionId(pos.id)
    setTitle(pos.title)
    setDegreeType(pos.degreeType)
    setResearchArea(pos.researchArea)
    setDescription(pos.description)
    setResearchTopics(pos.researchTopics || [])
    setRequiredSkills(pos.requiredSkills || [])
    setPreferredSkills(pos.preferredSkills || [])
    setMinimumGPA(String(pos.minimumGPA || 3.5))
    setFundingType(pos.fundingType)
    setStipend(pos.stipend || '')
    setApplicationDeadline(pos.applicationDeadline || '')
    setStartDate(pos.startDate || '')
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim() || !description.trim()) return

    setSaving(true)
    setErrorMsg(null)
    const now = new Date().toISOString()

    try {
      if (editingPositionId) {
        const existingPos = positions.find((p) => p.id === editingPositionId)
        if (!existingPos || existingPos.professorId !== user.uid) {
          setSaving(false)
          return
        }
        const updatedPos: Position = {
          ...existingPos,
          title: title.trim(),
          degreeType,
          researchArea,
          description: description.trim(),
          researchTopics: researchTopics.length ? researchTopics : [researchArea],
          requiredSkills,
          preferredSkills,
          minimumGPA: parseFloat(minimumGPA) || 3.0,
          fundingType,
          stipend: stipend.trim(),
          applicationDeadline,
          startDate: startDate.trim(),
          updatedAt: now,
        }

        await setDoc(doc(db, 'positions', editingPositionId), updatedPos, { merge: true })
        setPositions((prev) => prev.map((p) => (p.id === editingPositionId ? updatedPos : p)))
        setSuccessMsg('Research position updated successfully!')
      } else {
        const isVerified = verificationStatus === 'verified'
        const newId = `pos-${Date.now()}`
        const newPos: Position = {
          id: newId,
          professorId: user.uid,
          professorName: professorProfile?.fullName || user.displayName || 'Faculty Member',
          professorTitle: professorProfile?.academicTitle || 'Faculty',
          university: professorProfile?.university || '',
          department: professorProfile?.department || '',
          country: professorProfile?.country || '',
          title: title.trim(),
          degreeType,
          researchArea,
          description: description.trim(),
          researchTopics: researchTopics.length ? researchTopics : [researchArea],
          requiredSkills,
          preferredSkills,
          minimumGPA: parseFloat(minimumGPA) || 3.0,
          gpaScale: 4.0,
          languageRequirements: [],
          otherRequirements: '',
          fundingType,
          stipend: stipend.trim(),
          applicationDeadline: applicationDeadline || '',
          startDate: startDate.trim() || 'Spring 2027',
          isOpen: isVerified,
          createdAt: now,
          updatedAt: now,
        }

        await setDoc(doc(db, 'positions', newId), newPos)
        setPositions((prev) => [newPos, ...prev])
        setSuccessMsg(
          isVerified
            ? 'New research position published!'
            : 'Opportunity saved as draft (Unpublished). Faculty verification required to publish.'
        )
      }

      setIsFormOpen(false)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Failed to save position to Firestore:', err)
      setErrorMsg('Failed to save research opportunity. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string) => {
    if (!user) return
    const target = positions.find((p) => p.id === id)
    if (!target || target.professorId !== user.uid) return

    const nextOpen = !target.isOpen
    if (nextOpen && verificationStatus !== 'verified') {
      setSuccessMsg('Faculty verification required to open opportunities publicly.')
      setTimeout(() => setSuccessMsg(''), 4000)
      return
    }

    const now = new Date().toISOString()
    try {
      await updateDoc(doc(db, 'positions', id), {
        isOpen: nextOpen,
        updatedAt: now,
      })
      setPositions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isOpen: nextOpen, updatedAt: now } : p))
      )
      setErrorMsg(null)
    } catch (err) {
      console.error('Failed to toggle position status in Firestore:', err)
      setErrorMsg('Failed to update position status. Please try again.')
    }
  }

  const deletePosition = async (id: string) => {
    if (!user) return
    const target = positions.find((p) => p.id === id)
    if (!target || target.professorId !== user.uid) return

    try {
      await deleteDoc(doc(db, 'positions', id))
      setPositions((prev) => prev.filter((p) => p.id !== id))
      setErrorMsg(null)
    } catch (err) {
      console.error('Failed to delete position from Firestore:', err)
      setErrorMsg('Failed to delete research opportunity. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading research opportunities…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Header Bar */}
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
                  Research Opportunities
                </h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {positions.length} Positions
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage recruitment postings, eligibility criteria, stipends, and deadlines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {successMsg && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 animate-fade-in">
                <Check size={14} className="text-emerald-600" />
                <span>{successMsg}</span>
              </span>
            )}
            <Button
              onClick={openCreateForm}
              className="flex items-center gap-2 shadow-xs"
              id="create-position-btn"
            >
              <Plus size={16} />
              <span>Post New Position</span>
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-700 flex items-center gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Verification Alert Banner if not verified */}
        {verificationStatus !== 'verified' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs flex items-start gap-3 animate-fade-in">
            <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-amber-900">
                Institutional Affiliation Verification Required
              </h4>
              <p className="text-xs text-amber-800">
                Your faculty affiliation status is currently <strong className="uppercase underline font-bold">{verificationStatus}</strong>.
                You may draft research positions, but opportunities cannot be published publicly to accept student applications until an administrator confirms your credentials.
              </p>
            </div>
          </div>
        )}

        {/* Position Creation / Editing Drawer Form */}
        {isFormOpen && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-blue-200 shadow-md space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Briefcase size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    {editingPositionId ? 'Edit Research Opportunity' : 'Publish New Research Opportunity'}
                  </h3>
                  <p className="text-xs text-slate-500">Provide complete information to help AI match the best candidates</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="space-y-6" id="position-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Position Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. PhD Position — Medical AI & Histopathology Segmentation"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-title"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Degree Level *
                  </label>
                  <select
                    value={degreeType}
                    onChange={(e) => setDegreeType(e.target.value as DegreeType)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-degree"
                  >
                    <option value="PhD">Doctor of Philosophy (PhD)</option>
                    <option value="Master">Master of Science (MS)</option>
                    <option value="Research_Assistant">Undergraduate / Research Assistant</option>
                    <option value="PostDoc">Postdoctoral Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Primary Research Area *
                  </label>
                  <select
                    value={researchArea}
                    onChange={(e) => setResearchArea(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-area"
                  >
                    {RESEARCH_AREAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Funding Package *
                  </label>
                  <select
                    value={fundingType}
                    onChange={(e) => setFundingType(e.target.value as FundingType)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-funding"
                  >
                    <option value="fully_funded">Fully Funded (Tuition + Stipend)</option>
                    <option value="partially_funded">Partially Funded</option>
                    <option value="scholarship">University / Government Scholarship</option>
                    <option value="self_funded">Self-Funded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Monthly Stipend Amount
                  </label>
                  <input
                    type="text"
                    value={stipend}
                    onChange={(e) => setStipend(e.target.value)}
                    placeholder="e.g. 2,200,000 KRW/month"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-stipend"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Detailed Opportunity Description *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe research responsibilities, clinical collaborations, compute clusters, and publication goals…"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-desc"
                  />
                </div>

                <div className="sm:col-span-2">
                  <TagInput
                    label="Research Topics & Sub-Fields"
                    tags={researchTopics}
                    onChange={(tags) => setResearchTopics(tags)}
                    placeholder="e.g. Medical AI, Image Segmentation, Deep Learning"
                  />
                </div>

                <div>
                  <TagInput
                    label="Required Technical Skills"
                    tags={requiredSkills}
                    onChange={(tags) => setRequiredSkills(tags)}
                    placeholder="e.g. Python, PyTorch, CUDA"
                  />
                </div>

                <div>
                  <TagInput
                    label="Preferred Background"
                    tags={preferredSkills}
                    onChange={(tags) => setPreferredSkills(tags)}
                    placeholder="e.g. Medical Imaging, CVPR papers, C++"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Application Deadline
                  </label>
                  <input
                    type="date"
                    value={applicationDeadline}
                    onChange={(e) => setApplicationDeadline(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-deadline"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Expected Start Date
                  </label>
                  <input
                    type="text"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="e.g. Spring 2027 or Fall 2027"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-startDate"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} id="save-position-submit-btn">
                  {saving ? 'Saving…' : editingPositionId ? 'Save Changes' : 'Publish Position'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Positions List */}
        <div className="space-y-5">
          {positions.map((pos) => {
            const applicantCount = applicantCounts[pos.id] || 0
            return (
              <div
                key={pos.id}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all space-y-4"
                id={`position-row-${pos.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {pos.degreeType.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {FUNDING_LABELS[pos.fundingType] || pos.fundingType}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        pos.isOpen
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {pos.isOpen ? 'Actively Accepting Applications' : 'Recruitment Closed'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 font-display pt-1">{pos.title}</h3>
                    <p className="text-xs text-slate-500">
                      Department of {pos.department} • {pos.university}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditForm(pos)}
                      className="flex items-center gap-1 text-xs"
                      id={`edit-pos-${pos.id}`}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant={pos.isOpen ? 'secondary' : 'primary'}
                      onClick={() => toggleStatus(pos.id)}
                      className="text-xs"
                      id={`toggle-pos-${pos.id}`}
                    >
                      {pos.isOpen ? 'Close Opening' : 'Reopen Opening'}
                    </Button>

                    <button
                      onClick={() => deletePosition(pos.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete opening"
                      id={`delete-pos-${pos.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
                  {pos.description}
                </p>

                {/* Topics & Skills Tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Skills:</span>
                  {(pos.requiredSkills || []).map((skill) => (
                    <span
                      key={skill}
                      className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Footer Meta */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
                  <div className="flex items-center gap-4">
                    {pos.stipend && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <DollarSign size={13} className="text-emerald-600" />
                        {pos.stipend}
                      </span>
                    )}
                    {pos.applicationDeadline && (
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-blue-600" />
                        Deadline: <strong className="text-slate-800">{formatDate(pos.applicationDeadline)}</strong>
                      </span>
                    )}
                  </div>

                  <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {applicantCount} Candidate Application{applicantCount !== 1 ? 's' : ''} Received
                  </span>
                </div>
              </div>
            )
          })}

          {positions.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-2xs space-y-4">
              <Briefcase size={40} className="mx-auto text-slate-400 mb-2" />
              <h3 className="text-lg font-bold text-slate-900 font-display">No research positions posted</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Create recruitment calls for PhD students, Master's research assistants, or postdocs to start receiving matched applications.
              </p>
              <Button onClick={openCreateForm} className="mt-2">
                Create First Position
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
