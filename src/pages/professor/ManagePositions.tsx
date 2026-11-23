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
import { stripLegacyProfessorEmailIfPresent } from '@/lib/messaging'
import type { Position, DegreeType, FundingType } from '@/types/position.types'
import type { ProfessorProfile } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { TagInput } from '@/components/common/TagInput'
import { RESEARCH_AREAS, FUNDING_LABELS, formatDate } from '@/utils/helpers'

const ALLOWED_POSITION_KEYS = new Set([
  'id',
  'professorId',
  'professorName',
  'professorTitle',
  'professorPhotoURL',
  'university',
  'department',
  'country',
  'title',
  'degreeType',
  'description',
  'researchArea',
  'researchTopics',
  'requiredSkills',
  'preferredSkills',
  'minimumGPA',
  'gpaScale',
  'languageRequirements',
  'otherRequirements',
  'fundingType',
  'fundingDetails',
  'stipend',
  'applicationDeadline',
  'startDate',
  'isOpen',
  'createdAt',
  'updatedAt',
])

function sanitizePositionPayload(pos: Position): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(pos).filter(([key, val]) => ALLOWED_POSITION_KEYS.has(key) && val !== undefined)
  )
}

function getTodayIsoDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

  useEffect(() => {
    let isMounted = true

    async function loadManagePositionsData() {
      if (!user) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const [profRes, posRes, appRes] = await Promise.allSettled([
          getDoc(doc(db, 'professors', user.uid)),
          getDocs(query(collection(db, 'positions'), where('professorId', '==', user.uid))),
          getDocs(query(collection(db, 'applications'), where('professorId', '==', user.uid))),
        ])

        if (!isMounted) return

        if (profRes.status === 'fulfilled' && profRes.value.exists()) {
          const rawProf = profRes.value.data() as Record<string, unknown>
          stripLegacyProfessorEmailIfPresent(user.uid, rawProf)
          const profData = rawProf as unknown as ProfessorProfile
          setProfessorProfile(profData)
        }

        if (posRes.status === 'fulfilled') {
          const loadedPositions: Position[] = posRes.value.docs
            .map((d) => ({
              ...(d.data() as Position),
              id: d.id,
            }))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          setPositions(loadedPositions)
          setErrorMsg(null)
        } else {
          console.error('Failed to load professor positions from Firestore:', posRes.reason)
          setErrorMsg('Failed to load your research opportunities from the server. Please refresh and try again.')
        }

        if (appRes.status === 'fulfilled') {
          const counts: Record<string, number> = {}
          appRes.value.docs.forEach((d) => {
            const posId = (d.data() as { positionId?: string }).positionId
            if (posId) {
              counts[posId] = (counts[posId] || 0) + 1
            }
          })
          setApplicantCounts(counts)
        }
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
    setResearchArea(pos.researchArea || 'Computer Vision')
    setDescription(pos.description)
    setResearchTopics(pos.researchTopics || [])
    setRequiredSkills(pos.requiredSkills || [])
    setPreferredSkills(pos.preferredSkills || [])
    setMinimumGPA(
      typeof pos.minimumGPA === 'number' && !Number.isNaN(pos.minimumGPA)
        ? String(pos.minimumGPA)
        : '3.5'
    )
    setFundingType(pos.fundingType)
    setStipend(pos.stipend || '')
    setApplicationDeadline(pos.applicationDeadline || '')
    setStartDate(pos.startDate || '')
    setErrorMsg(null)
    setIsFormOpen(true)
  }

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const trimmedTitle = title.trim()
    const trimmedDesc = description.trim()
    if (!trimmedTitle) {
      setErrorMsg('Please enter a position title.')
      return
    }
    if (trimmedTitle.length > 200) {
      setErrorMsg('Position title must be 200 characters or fewer.')
      return
    }
    if (!trimmedDesc) {
      setErrorMsg('Please enter a detailed opportunity description.')
      return
    }

    let resolvedMinGpa = 0
    if (minimumGPA.trim() !== '') {
      const parsedGpa = Number(minimumGPA)
      if (Number.isNaN(parsedGpa) || parsedGpa < 0 || parsedGpa > 4.0) {
        setErrorMsg('Minimum GPA must be a number between 0.0 and 4.0.')
        return
      }
      resolvedMinGpa = Math.round(parsedGpa * 100) / 100
    }

    const trimmedDeadline = applicationDeadline.trim()
    if (trimmedDeadline) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDeadline) || Number.isNaN(Date.parse(trimmedDeadline))) {
        setErrorMsg('Please enter a valid application deadline date.')
        return
      }
      const existingPos = editingPositionId
        ? positions.find((p) => p.id === editingPositionId)
        : undefined
      const deadlineChanged = !existingPos || existingPos.applicationDeadline !== trimmedDeadline
      if (deadlineChanged && trimmedDeadline < getTodayIsoDate()) {
        setErrorMsg('Application deadline cannot be set to a date in the past.')
        return
      }
    }

    setSaving(true)
    setErrorMsg(null)
    const now = new Date().toISOString()

    try {
      if (editingPositionId) {
        const existingPos = positions.find((p) => p.id === editingPositionId)
        if (!existingPos || existingPos.professorId !== user.uid) {
          setErrorMsg('You can only edit your own research opportunities.')
          setSaving(false)
          return
        }
        const resolvedPhoto =
          professorProfile?.photoURL || existingPos.professorPhotoURL || user.photoURL || undefined
        const updatedPos: Position = {
          ...existingPos,
          id: editingPositionId,
          professorId: user.uid,
          professorName:
            professorProfile?.fullName || existingPos.professorName || user.displayName || 'Faculty Member',
          professorTitle:
            professorProfile?.academicTitle || existingPos.professorTitle || 'Faculty',
          ...(resolvedPhoto ? { professorPhotoURL: resolvedPhoto } : {}),
          university: professorProfile?.university || existingPos.university || '',
          department: professorProfile?.department || existingPos.department || '',
          country: professorProfile?.country || existingPos.country || '',
          title: trimmedTitle,
          degreeType,
          researchArea,
          description: trimmedDesc,
          researchTopics: researchTopics.length ? researchTopics : [researchArea],
          requiredSkills,
          preferredSkills,
          minimumGPA: resolvedMinGpa,
          gpaScale: existingPos.gpaScale || 4.0,
          languageRequirements: Array.isArray(existingPos.languageRequirements)
            ? existingPos.languageRequirements
            : [],
          otherRequirements: existingPos.otherRequirements || '',
          fundingType,
          stipend: stipend.trim(),
          applicationDeadline: trimmedDeadline,
          startDate: startDate.trim(),
          updatedAt: now,
        }

        await setDoc(doc(db, 'positions', editingPositionId), sanitizePositionPayload(updatedPos))
        setPositions((prev) => prev.map((p) => (p.id === editingPositionId ? updatedPos : p)))
        setSuccessMsg('Research position updated successfully!')
      } else {
        const newId = `pos-${Date.now()}`
        const resolvedPhoto = professorProfile?.photoURL || user.photoURL || undefined
        const newPos: Position = {
          id: newId,
          professorId: user.uid,
          professorName: professorProfile?.fullName || user.displayName || 'Faculty Member',
          professorTitle: professorProfile?.academicTitle || 'Faculty',
          ...(resolvedPhoto ? { professorPhotoURL: resolvedPhoto } : {}),
          university: professorProfile?.university || '',
          department: professorProfile?.department || '',
          country: professorProfile?.country || '',
          title: trimmedTitle,
          degreeType,
          researchArea,
          description: trimmedDesc,
          researchTopics: researchTopics.length ? researchTopics : [researchArea],
          requiredSkills,
          preferredSkills,
          minimumGPA: resolvedMinGpa,
          gpaScale: 4.0,
          languageRequirements: [],
          otherRequirements: '',
          fundingType,
          stipend: stipend.trim(),
          applicationDeadline: trimmedDeadline,
          startDate: startDate.trim() || 'Spring 2027',
          isOpen: true,
          createdAt: now,
          updatedAt: now,
        }

        await setDoc(doc(db, 'positions', newId), sanitizePositionPayload(newPos))
        setPositions((prev) => [newPos, ...prev])
        setSuccessMsg('New research position published!')
      }

      setIsFormOpen(false)
      setEditingPositionId(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Failed to save position to Firestore:', err)
      const code = (err as { code?: string })?.code
      setErrorMsg(
        `Failed to save research opportunity${code ? ` (${code})` : ''}. Please check your connection and try again.`
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string) => {
    if (!user) return
    const target = positions.find((p) => p.id === id)
    if (!target || target.professorId !== user.uid) return

    const nextOpen = !target.isOpen
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
      setSuccessMsg(nextOpen ? 'Research opportunity reopened!' : 'Research opportunity closed.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Failed to toggle position status in Firestore:', err)
      const code = (err as { code?: string })?.code
      setErrorMsg(`Failed to update position status${code ? ` (${code})` : ''}. Please try again.`)
    }
  }

  const deletePosition = async (id: string) => {
    if (!user) return
    const target = positions.find((p) => p.id === id)
    if (!target || target.professorId !== user.uid) return
    if (!window.confirm(`Are you sure you want to delete "${target.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteDoc(doc(db, 'positions', id))
      setPositions((prev) => prev.filter((p) => p.id !== id))
      if (editingPositionId === id) {
        setIsFormOpen(false)
        setEditingPositionId(null)
      }
      setErrorMsg(null)
      setSuccessMsg('Research opportunity deleted.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      console.error('Failed to delete position from Firestore:', err)
      const code = (err as { code?: string })?.code
      setErrorMsg(`Failed to delete research opportunity${code ? ` (${code})` : ''}. Please try again.`)
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
                    {researchArea && !RESEARCH_AREAS.includes(researchArea) && (
                      <option value={researchArea}>{researchArea}</option>
                    )}
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
                    Minimum GPA (4.0 Scale)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="4.0"
                    value={minimumGPA}
                    onChange={(e) => setMinimumGPA(e.target.value)}
                    placeholder="e.g. 3.5 (or 0 for no minimum)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                    id="position-min-gpa"
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
