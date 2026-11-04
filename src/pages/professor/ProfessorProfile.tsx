import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore'
import { 
  MapPin, Globe, ExternalLink, Heart, 
  Calendar, DollarSign, GraduationCap, Mail,
  Sparkles, ArrowLeft, ArrowUpRight,
  Building, Briefcase, AlertCircle, RefreshCw
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import type { MatchResult } from '@/types/match.types'
import { computeMatch } from '@/lib/matching'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { MatchScoreBadge } from '@/components/matching/MatchScore'
import { RecruitingBadge } from '@/components/common/Badges'
import { formatDate, FUNDING_LABELS, cn } from '@/utils/helpers'

type Tab = 'overview' | 'research' | 'positions' | 'publications' | 'lab'

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

export default function ProfessorProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const [professor, setProfessor] = useState<(ProfessorProfile & { positions: Position[] }) | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isSaved, setIsSaved] = useState(false)

  const toggleSave = () => {
    setIsSaved((prev) => !prev)
  }

  // Load professor from Firestore
  const loadProfessor = useCallback(async () => {
    if (!username) {
      setProfessor(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')

    try {
      const snap = await getDocs(
        query(collection(db, 'professors'), where('username', '==', username), limit(1))
      )
      if (!snap.empty) {
        const docSnap = snap.docs[0]
        const rawProf = docSnap.data() as Partial<ProfessorProfile>
        const profUid = rawProf.uid || docSnap.id

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

        setProfessor({
          ...(rawProf as ProfessorProfile),
          uid: profUid,
          fullName: rawProf.fullName ?? 'Professor',
          username: rawProf.username ?? username,
          academicTitle: rawProf.academicTitle ?? '',
          university: rawProf.university ?? '',
          department: rawProf.department ?? '',
          country: rawProf.country ?? '',
          biography: rawProf.biography ?? '',
          researchAreas: Array.isArray(rawProf.researchAreas) ? rawProf.researchAreas : [],
          researchInterests: Array.isArray(rawProf.researchInterests) ? rawProf.researchInterests : [],
          currentProjects: Array.isArray(rawProf.currentProjects) ? rawProf.currentProjects : [],
          publications: Array.isArray(rawProf.publications) ? rawProf.publications : [],
          labMembers: Array.isArray(rawProf.labMembers) ? rawProf.labMembers : [],
          recruitingStatus: rawProf.recruitingStatus ?? 'not_recruiting',
          isRecruiting: Boolean(rawProf.isRecruiting),
          positions,
        })
      } else {
        setProfessor(null)
      }
    } catch (err) {
      console.error('Failed to query professor:', err)
      setLoadError('Failed to load faculty profile from Firebase. Please check your connection and try again.')
      setProfessor(null)
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    loadProfessor()
  }, [loadProfessor])

  // Load student profile for match calculation
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

  // Calculate match score
  useEffect(() => {
    if (studentProfile && professor?.positions?.length) {
      const results = professor.positions.map((p) => computeMatch(studentProfile, p))
      const best = results.reduce((a, b) => (a.score > b.score ? a : b))
      setMatchResult(best)
    } else {
      setMatchResult(null)
    }
  }, [studentProfile, professor])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xs space-y-4 animate-pulse">
          <div className="flex gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-64 bg-slate-200 rounded" />
              <div className="h-4 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-20 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center shadow-2xs max-w-md space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-display">Unable to Load Profile</h2>
          <p className="text-sm text-slate-500">{loadError}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/search')}>Back to Directory</Button>
            <Button onClick={loadProfessor} className="flex items-center gap-1.5">
              <RefreshCw size={14} />
              <span>Retry</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!professor) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-20 px-4 flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs max-w-md">
          <GraduationCap size={44} className="mx-auto text-slate-400 mb-3" />
          <h2 className="text-xl font-bold text-slate-900 font-display mb-1.5">Professor Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            The faculty profile you are looking for is unavailable or does not exist.
          </p>
          <Button onClick={() => navigate('/search')}>Back to Directory</Button>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'research', label: 'Research Projects', count: professor.currentProjects?.length || 0 },
    { id: 'positions', label: 'Open Positions', count: professor.positions?.length || 0 },
    { id: 'publications', label: 'Publications', count: professor.publications?.length || 0 },
    { id: 'lab', label: 'Lab & Team' },
  ]

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button
            onClick={() => navigate('/search')}
            className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Search Directory</span>
          </button>
          <span>/</span>
          <span className="text-slate-800 font-bold">{professor.fullName}</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 sm:p-8 relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            
            {/* Avatar & Match Score */}
            <div className="flex flex-col items-center gap-3 shrink-0 self-center md:self-start">
              <Avatar src={professor.photoURL} name={professor.fullName} size="xl" className="ring-4 ring-slate-100" />
              {matchResult && (
                <div className="text-center">
                  <MatchScoreBadge score={matchResult.score} size="md" showLabel />
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">with your background</p>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                    {professor.fullName}
                  </h1>
                  <p className="text-sm font-semibold text-blue-600 mt-0.5">
                    {professor.academicTitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 mt-2 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Building size={13} className="text-slate-400" />
                      <strong className="text-slate-800">{professor.university}</strong>
                    </span>
                    {professor.department && (
                      <>
                        <span>•</span>
                        <span>{professor.department}</span>
                      </>
                    )}
                    {professor.country && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin size={13} className="text-slate-400" />
                          {professor.country}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <RecruitingBadge status={professor.recruitingStatus} />
                </div>
              </div>

              {/* Research Areas */}
              <div className="flex flex-wrap gap-1.5">
                {(professor.researchAreas || []).map((area) => (
                  <span
                    key={area}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50/80 border border-blue-200/70 text-blue-800"
                  >
                    {area}
                  </span>
                ))}
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {professor.positions.length > 0 && (
                  <Button
                    onClick={() => setActiveTab('positions')}
                    className="flex items-center gap-2 shadow-xs"
                    id="view-positions-btn"
                  >
                    <GraduationCap size={16} />
                    <span>View {professor.positions.length} Open Position{professor.positions.length !== 1 ? 's' : ''}</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={toggleSave}
                  className={cn(
                    'flex items-center gap-2 transition-colors',
                    isSaved ? 'text-rose-600 border-rose-300 bg-rose-50/50' : 'text-slate-700'
                  )}
                  id="save-professor-btn"
                >
                  <Heart size={16} className={isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
                  <span>{isSaved ? 'Bookmarked' : 'Save Faculty'}</span>
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => navigate('/messages')}
                  className="flex items-center gap-2"
                  id="message-professor-btn"
                >
                  <Mail size={16} />
                  <span>Send Inquiry</span>
                </Button>
              </div>

              {/* External Links */}
              <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-slate-500 border-t border-slate-100">
                {professor.universityProfileUrl && (
                  <a
                    href={professor.universityProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <Globe size={13} className="text-slate-400" />
                    <span>Faculty Page</span>
                  </a>
                )}
                {professor.googleScholarUrl && (
                  <a
                    href={professor.googleScholarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink size={13} className="text-slate-400" />
                    <span>Google Scholar</span>
                  </a>
                )}
                {professor.orcid && (
                  <a
                    href={`https://orcid.org/${professor.orcid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink size={13} className="text-slate-400" />
                    <span>ORCID: {professor.orcid}</span>
                  </a>
                )}
                {professor.personalWebpageUrl && (
                  <a
                    href={professor.personalWebpageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 flex items-center gap-1 transition-colors"
                  >
                    <Globe size={13} className="text-slate-400" />
                    <span>Lab Website</span>
                  </a>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Content Layout: Left Tabs & Right Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Tabs Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tab Navigation Pill Bar */}
            <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-200/60 rounded-2xl border border-slate-200/80">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                    activeTab === tab.id
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  )}
                  id={`tab-${tab.id}`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                        activeTab === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-4">
                  <h3 className="font-display text-lg font-bold text-slate-900">Faculty Biography</h3>
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                    {professor.biography || 'No biography provided yet.'}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-4">
                  <h3 className="font-display text-lg font-bold text-slate-900">Research Interests</h3>
                  {(professor.researchInterests || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(professor.researchInterests || []).map((interest) => (
                        <span
                          key={interest}
                          className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No research interests listed yet.</p>
                  )}
                </div>

                {professor.labDescription && (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-3">
                    <h3 className="font-display text-lg font-bold text-slate-900">{professor.labName || 'Research Laboratory'}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {professor.labDescription}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Research Projects */}
            {activeTab === 'research' && (
              <div className="space-y-4">
                {(professor.currentProjects || []).length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xs text-center text-xs text-slate-400 italic">
                    No active research projects listed yet.
                  </div>
                ) : (
                  (professor.currentProjects || []).map((project) => (
                    <div
                      key={project.id}
                      className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="font-display text-base font-bold text-slate-900">{project.title}</h4>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Ongoing Project
                        </span>
                      </div>

                      <p className="text-slate-600 text-sm leading-relaxed">
                        {project.description}
                      </p>

                      {project.fundingSource && (
                        <div className="pt-2 flex items-center gap-2 text-xs text-slate-500 font-medium">
                          <DollarSign size={13} className="text-emerald-600 shrink-0" />
                          <span>Funded by: <strong className="text-slate-700">{project.fundingSource}</strong></span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Open Positions */}
            {activeTab === 'positions' && (
              <div className="space-y-5">
                {professor.positions.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xs text-center text-xs text-slate-400 italic">
                    No open research positions posted at this time.
                  </div>
                ) : (
                  professor.positions.map((pos) => (
                    <div
                      key={pos.id}
                      className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-5 hover:border-blue-300 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                              {pos.degreeType.replace('_', ' ')}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                              {FUNDING_LABELS[pos.fundingType] || pos.fundingType}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 font-display">{pos.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {pos.department ? `Department of ${pos.department} • ` : ''}{pos.university}
                          </p>
                        </div>

                        <Button
                          onClick={() => navigate(`/apply/${pos.id}`)}
                          className="flex items-center gap-1.5 shrink-0 shadow-xs"
                        >
                          <span>Apply Now</span>
                          <ArrowUpRight size={15} />
                        </Button>
                      </div>

                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                        {pos.description}
                      </p>

                      {/* Requirements Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <span className="font-semibold text-slate-700 block mb-1">Required Skills:</span>
                          <div className="flex flex-wrap gap-1">
                            {(pos.requiredSkills || []).map((s) => (
                              <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-700 block mb-1">Preferred Background:</span>
                          <div className="flex flex-wrap gap-1">
                            {(pos.preferredSkills || []).map((s) => (
                              <span key={s} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Stipend & Deadline Meta */}
                      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                        {pos.stipend && (
                          <div className="flex items-center gap-1 text-slate-700">
                            <DollarSign size={13} className="text-emerald-600" />
                            <span>Stipend: <strong className="text-slate-900">{pos.stipend}</strong></span>
                          </div>
                        )}
                        {pos.applicationDeadline && (
                          <div className="flex items-center gap-1">
                            <Calendar size={13} className="text-blue-600" />
                            <span>Deadline: <strong className="text-slate-900">{formatDate(pos.applicationDeadline)}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Publications */}
            {activeTab === 'publications' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-4">
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">Featured Publications</h3>
                {(professor.publications || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No publications listed yet.</p>
                ) : (
                  <div className="space-y-3.5">
                    {(professor.publications || []).map((pub) => (
                      <div
                        key={pub.id}
                        className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5"
                      >
                        <h5 className="font-bold text-slate-900 text-sm leading-snug">{pub.title}</h5>
                        <p className="text-xs text-slate-500">
                          {pub.journal || pub.conference} ({pub.year}) • Authors: {(pub.authors || []).join(', ')}
                        </p>
                        {pub.doi && <p className="text-[11px] text-blue-600 font-mono">DOI: {pub.doi}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Lab & Team */}
            {activeTab === 'lab' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">{professor.labName || 'Research Group'}</h3>
                  <p className="text-sm text-slate-600 mt-1">{professor.labDescription || 'No lab description provided yet.'}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                    Active Lab Members
                  </h4>
                  {(professor.labMembers || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No lab members listed yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(professor.labMembers || []).map((member) => (
                        <div
                          key={member.id}
                          className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-center gap-3"
                        >
                          <Avatar name={member.name} size="sm" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{member.name}</p>
                            <p className="text-[11px] text-slate-500">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Lab Info Card & Match Breakdown */}
          <div className="space-y-6">
            
            {/* Match Breakdown Panel */}
            {matchResult && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-600" />
                    <h3 className="font-display text-sm font-bold text-slate-900">Match Compatibility</h3>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {matchResult.score}% Overall
                  </span>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(matchResult.breakdown).map(([factor, score]) => (
                    <div key={factor} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-600 capitalize">{factor.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-slate-900 font-bold">{score}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {matchResult.explanation && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/70 italic">
                    "{matchResult.explanation}"
                  </p>
                )}
              </div>
            )}

            {/* Quick Contact & Details Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <h3 className="font-display text-sm font-bold text-slate-900">Faculty Details</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Building size={14} className="text-slate-400 shrink-0" />
                  <span>{professor.department || 'Department not listed'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-600">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  <span>{professor.university}{professor.country ? `, ${professor.country}` : ''}</span>
                </div>
                {professor.email && (
                  <div className="flex items-center gap-2.5 text-slate-600">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <a href={`mailto:${professor.email}`} className="text-blue-600 hover:underline">
                      {professor.email}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Briefcase size={14} className="text-slate-400 shrink-0" />
                  <span>{professor.positions.length} Active Position{professor.positions.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
