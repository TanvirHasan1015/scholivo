import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { 
  Search, MapPin, GraduationCap, X, SlidersHorizontal, 
  Sparkles, ArrowUpRight, AlertCircle, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import type { ProfessorWithPositions } from '@/lib/demoData'
import { useAuth } from '@/context/AuthContext'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import { computeMatch } from '@/lib/matching'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { MatchChip } from '@/components/matching/MatchScore'
import { RecruitingBadge } from '@/components/common/Badges'
import { RESEARCH_AREAS, COUNTRIES, FUNDING_LABELS, cn } from '@/utils/helpers'

const DEGREE_FILTER_OPTIONS = ['Master', 'PhD', 'Research_Assistant', 'PostDoc']
const FUNDING_FILTER_OPTIONS = Object.keys(FUNDING_LABELS)

function normalizeStudentForMatch(raw: Partial<StudentProfile>, uid: string): StudentProfile {
  return {
    uid: raw.uid || uid,
    fullName: raw.fullName ?? '',
    username: raw.username ?? '',
    email: raw.email ?? '',
    country: raw.country ?? '',
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
    profileCompleteness: raw.profileCompleteness ?? 0,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  }
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [professors, setProfessors] = useState<ProfessorWithPositions[]>([])
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Keep search query synced with URL searchParams
  useEffect(() => {
    setQ(searchParams.get('q') || '')
  }, [searchParams])

  // Filter state
  const [filters, setFilters] = useState({
    researchArea: '',
    university: '',
    country: '',
    degree: '',
    funding: '',
    recruiting: false,
  })

  // Load student profile for matching
  useEffect(() => {
    if (!user || role !== 'student') {
      setStudentProfile(null)
      return
    }

    let cancelled = false
    async function fetchStudent() {
      try {
        const directSnap = await getDoc(doc(db, 'students', user!.uid))
        if (directSnap.exists()) {
          if (!cancelled) {
            setStudentProfile(normalizeStudentForMatch(directSnap.data() as Partial<StudentProfile>, user!.uid))
          }
          return
        }
        const fallbackSnap = await getDocs(
          query(collection(db, 'students'), where('uid', '==', user!.uid), limit(1))
        )
        if (!fallbackSnap.empty && !cancelled) {
          setStudentProfile(normalizeStudentForMatch(fallbackSnap.docs[0].data() as Partial<StudentProfile>, user!.uid))
        }
      } catch (err) {
        console.error('Failed to load student profile for matching:', err)
      }
    }
    fetchStudent()
    return () => {
      cancelled = true
    }
  }, [user, role])

  // Load professors from Firestore
  const loadProfessors = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const snap = await getDocs(
        query(collection(db, 'professors'), limit(50))
      )

      const results: ProfessorWithPositions[] = []

      for (const docSnap of snap.docs) {
        const rawProf = docSnap.data() as Partial<ProfessorProfile>
        const profUid = rawProf.uid || docSnap.id

        // Load open positions for this professor
        const posSnap = await getDocs(
          query(collection(db, 'positions'), where('professorId', '==', profUid), where('isOpen', '==', true))
        )
        const positions = posSnap.docs.map((d) => {
          const rawPos = d.data() as Partial<Position>
          return {
            ...rawPos,
            id: d.id,
            researchTopics: Array.isArray(rawPos.researchTopics) ? rawPos.researchTopics : [],
            requiredSkills: Array.isArray(rawPos.requiredSkills) ? rawPos.requiredSkills : [],
            preferredSkills: Array.isArray(rawPos.preferredSkills) ? rawPos.preferredSkills : [],
            languageRequirements: Array.isArray(rawPos.languageRequirements) ? rawPos.languageRequirements : [],
            researchArea: rawPos.researchArea ?? '',
          } as Position
        })

        results.push({
          ...(rawProf as ProfessorProfile),
          uid: profUid,
          fullName: rawProf.fullName ?? 'Professor',
          username: rawProf.username ?? profUid,
          academicTitle: rawProf.academicTitle ?? '',
          university: rawProf.university ?? '',
          department: rawProf.department ?? '',
          country: rawProf.country ?? '',
          researchAreas: Array.isArray(rawProf.researchAreas) ? rawProf.researchAreas : [],
          researchInterests: Array.isArray(rawProf.researchInterests) ? rawProf.researchInterests : [],
          recruitingStatus: rawProf.recruitingStatus ?? 'not_recruiting',
          isRecruiting: Boolean(rawProf.isRecruiting),
          positions,
        })
      }

      setProfessors(results)
    } catch (err) {
      console.error('Failed to load professors:', err)
      setLoadError('Failed to load faculty directory from Firebase. Please check your connection and try again.')
      setProfessors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfessors()
  }, [loadProfessors])

  // Compute match scores when student profile loads
  const professorsWithScores = professors.map((prof) => {
    if (!studentProfile || !prof.positions.length) return prof
    const bestScore = Math.max(
      ...prof.positions.map((p) => computeMatch(studentProfile, p).score)
    )
    return { ...prof, matchScore: bestScore }
  })

  // Normalize terms to handle case and en-dash/hyphen differences
  const normalize = (val: string) =>
    val
      .toLowerCase()
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()

  // Filter + search
  const filtered = professorsWithScores.filter((prof) => {
    const qNorm = normalize(q)
    const matchesQ =
      !q ||
      [
        prof.fullName,
        prof.university,
        prof.department,
        ...(prof.researchAreas || []),
        ...(prof.researchInterests || []),
        ...prof.positions.flatMap((p) => [p.title, p.researchArea, ...(p.researchTopics || [])]),
      ].some((val) => val && normalize(val).includes(qNorm))

    const matchesArea =
      !filters.researchArea ||
      (prof.researchAreas || []).some((a) => normalize(a) === normalize(filters.researchArea))
    const matchesCountry = !filters.country || prof.country === filters.country
    const matchesUni =
      !filters.university || normalize(prof.university || '').includes(normalize(filters.university))
    const matchesRecruiting = !filters.recruiting || prof.isRecruiting
    const matchesDegree = !filters.degree || prof.positions.some((p) => p.degreeType === filters.degree)
    const matchesFunding = !filters.funding || prof.positions.some((p) => p.fundingType === filters.funding)

    return (
      matchesQ &&
      matchesArea &&
      matchesCountry &&
      matchesUni &&
      matchesRecruiting &&
      matchesDegree &&
      matchesFunding
    )
  }).sort((a, b) => {
    if (a.matchScore && b.matchScore) return b.matchScore - a.matchScore
    return 0
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(q ? { q } : {})
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Title & Search Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-2">
                <Sparkles size={13} className="text-blue-600" />
                <span>Professor Directory</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Find Research Labs & Professors
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Search faculty by research field, institution, and funded graduate openings
              </p>
            </div>
          </div>

          {/* Search Bar Row */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 bg-white rounded-2xl px-4 border border-slate-200 shadow-2xs focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search professors, research topics, keywords, or universities…"
                className="flex-1 bg-transparent outline-none text-slate-900 placeholder:text-slate-400 py-3.5 text-sm"
                id="search-input"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('')
                    setSearchParams({})
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button type="submit" size="lg" className="px-6 shadow-xs" id="search-submit-btn">
                Search
              </Button>
              
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer shadow-2xs',
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                )}
                id="filter-toggle-btn"
              >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Expanded Filter Panel */}
          {showFilters && (
            <div className="pt-5 border-t border-slate-100 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    Research Area
                  </label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none"
                    value={filters.researchArea}
                    onChange={(e) => setFilters({ ...filters, researchArea: e.target.value })}
                    id="filter-area"
                  >
                    <option value="">All Research Areas</option>
                    {RESEARCH_AREAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    Country
                  </label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none"
                    value={filters.country}
                    onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                    id="filter-country"
                  >
                    <option value="">All Countries</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    Degree Type
                  </label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none"
                    value={filters.degree}
                    onChange={(e) => setFilters({ ...filters, degree: e.target.value })}
                    id="filter-degree"
                  >
                    <option value="">Any Degree Opening</option>
                    {DEGREE_FILTER_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    Funding Status
                  </label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none"
                    value={filters.funding}
                    onChange={(e) => setFilters({ ...filters, funding: e.target.value })}
                    id="filter-funding"
                  >
                    <option value="">Any Funding</option>
                    {FUNDING_FILTER_OPTIONS.map((f) => (
                      <option key={f} value={f}>{FUNDING_LABELS[f]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    University Filter
                  </label>
                  <input
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none placeholder:text-slate-400"
                    placeholder="e.g. KAIST, MIT, SNU"
                    value={filters.university}
                    onChange={(e) => setFilters({ ...filters, university: e.target.value })}
                    id="filter-university"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={filters.recruiting}
                      onChange={(e) => setFilters({ ...filters, recruiting: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      id="filter-recruiting"
                    />
                    <span className="text-xs font-semibold text-slate-800">Actively Recruiting</span>
                  </label>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Showing filtered results with {activeFilterCount} active criteria
                  </span>
                  <button
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                    onClick={() => setFilters({ researchArea: '', university: '', country: '', degree: '', funding: '', recruiting: false })}
                    id="clear-filters-btn"
                  >
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Header Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <p className="text-slate-600 text-sm font-medium">
            {loading ? (
              'Searching faculty directory…'
            ) : (
              <>
                <strong className="text-slate-900 font-bold">{filtered.length}</strong> professor{filtered.length !== 1 ? 's' : ''} found
                {q && (
                  <span className="text-slate-500 font-normal">
                    {' '}matching "<strong className="text-slate-800 font-medium">{q}</strong>"
                  </span>
                )}
              </>
            )}
          </p>

          {studentProfile && (
            <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Match scores computed for {studentProfile.fullName || user?.displayName || 'your profile'}</span>
            </p>
          )}
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 bg-slate-200 rounded-full" />
                  <div className="h-6 w-24 bg-slate-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center shadow-2xs max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-600">
              <AlertCircle size={26} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Unable to Load Faculty Directory</h3>
            <p className="text-sm text-slate-500">{loadError}</p>
            <Button onClick={loadProfessors} className="flex items-center gap-1.5 mx-auto">
              <RefreshCw size={14} />
              <span>Retry</span>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Search size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">No matching faculty found</h3>
            <p className="text-sm text-slate-500">
              {professors.length === 0
                ? 'No professor profiles have been published in the directory yet.'
                : 'No professors matched your exact keywords or selected filters. Try broadening your search or resetting active filters.'}
            </p>
            {(q || activeFilterCount > 0) && (
              <Button
                variant="outline"
                onClick={() => {
                  setQ('')
                  setSearchParams({})
                  setFilters({ researchArea: '', university: '', country: '', degree: '', funding: '', recruiting: false })
                }}
                className="mt-2"
              >
                Reset Search & Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((prof) => (
              <ProfessorCard
                key={prof.uid}
                professor={prof}
                onClick={() => navigate(`/professor/${prof.username}`)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Redesigned Professor Card Component ──────────────────────────────────────

function ProfessorCard({
  professor,
  onClick,
}: {
  professor: ProfessorWithPositions
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
      id={`prof-card-${professor.uid}`}
    >
      <div>
        {/* Header: Avatar, Name, Title, University & Match Score */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <Avatar src={professor.photoURL} name={professor.fullName} size="md" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug truncate">
                {professor.fullName}
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {professor.academicTitle}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-600 font-medium mt-1 truncate">
                <MapPin size={11} className="text-slate-400 shrink-0" />
                <span className="truncate">{professor.university}</span>
              </div>
            </div>
          </div>

          {professor.matchScore !== undefined && (
            <MatchChip score={professor.matchScore} />
          )}
        </div>

        {/* Recruiting Badge */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <RecruitingBadge status={professor.recruitingStatus} />
        </div>

        {/* Research Area Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {(professor.researchAreas || []).slice(0, 3).map((area) => (
            <span
              key={area}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700"
            >
              {area}
            </span>
          ))}
          {(professor.researchAreas || []).length > 3 && (
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">
              +{(professor.researchAreas || []).length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Positions Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        {professor.positions.length > 0 ? (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <GraduationCap size={14} className="text-blue-600" />
              <span>
                {professor.positions.length} open position{professor.positions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {professor.positions.slice(0, 2).map((pos) => (
                <span
                  key={pos.id}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {pos.degreeType.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">No current open positions</span>
        )}

        <div className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:text-blue-700">
          <span>View Profile</span>
          <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </div>
    </div>
  )
}
