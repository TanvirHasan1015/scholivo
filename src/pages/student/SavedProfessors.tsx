import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { Heart, MapPin, Building, ArrowLeft, BookmarkCheck, Search, ArrowUpRight, AlertCircle } from 'lucide-react'
import { db } from '@/lib/firebase'
import { loadSplitStudentProfile, saveStudentSavedProfessors } from '@/lib/messaging'
import { useAuth } from '@/context/AuthContext'
import type { StudentProfile, ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'
import { computeMatch } from '@/lib/matching'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'

interface SavedProfessorItem {
  uid: string
  username: string
  fullName: string
  academicTitle: string
  university: string
  country: string
  photoURL?: string
  researchAreas: string[]
  matchScore: number
  openPositionsCount: number
  isRecruiting: boolean
  positionsError?: 'permission_denied' | 'network_error' | null
}

export default function SavedProfessors() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saved, setSaved] = useState<SavedProfessorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savedError, setSavedError] = useState<'permission_denied' | 'network_error' | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSavedProfessors() {
      if (!user) {
        if (isMounted) {
          setSaved([])
          setLoading(false)
        }
        return
      }

      try {
        const loaded = await loadSplitStudentProfile(user.uid)
        if (!isMounted) return
        if (!loaded.exists) {
          setSaved([])
          return
        }

        const studentData = loaded.data as StudentProfile
        const savedIds = Array.isArray(studentData.savedProfessorIds)
          ? studentData.savedProfessorIds
          : []

        if (savedIds.length === 0) {
          setSaved([])
          return
        }

        const normalizedStudent: StudentProfile = {
          ...studentData,
          uid: studentData.uid || user.uid,
          researchInterests: Array.isArray(studentData.researchInterests) ? studentData.researchInterests : [],
          researchAreas: Array.isArray(studentData.researchAreas) ? studentData.researchAreas : [],
          researchExperience: Array.isArray(studentData.researchExperience) ? studentData.researchExperience : [],
          projects: Array.isArray(studentData.projects) ? studentData.projects : [],
          publications: Array.isArray(studentData.publications) ? studentData.publications : [],
          programmingLanguages: Array.isArray(studentData.programmingLanguages) ? studentData.programmingLanguages : [],
          frameworks: Array.isArray(studentData.frameworks) ? studentData.frameworks : [],
          technicalSkills: Array.isArray(studentData.technicalSkills) ? studentData.technicalSkills : [],
          researchTools: Array.isArray(studentData.researchTools) ? studentData.researchTools : [],
          languageScores: Array.isArray(studentData.languageScores) ? studentData.languageScores : [],
        }

        let hasPermissionDenied = false
        let hasNetworkError = false

        const resolved: SavedProfessorItem[] = []
        for (const profId of savedIds) {
          const profSnap = await getDoc(doc(db, 'professors', profId))
          if (!profSnap.exists()) continue
          const prof = profSnap.data() as ProfessorProfile
          const profUid = prof.uid || profSnap.id

          let positions: Position[] = []
          let posError: 'permission_denied' | 'network_error' | null = null

          try {
            const posSnap = await getDocs(
              query(collection(db, 'positions'), where('professorId', '==', profUid), where('isOpen', '==', true))
            )
            positions = posSnap.docs.map((d) => ({ ...(d.data() as Position), id: d.id }))
          } catch (posErr: unknown) {
            console.error('Failed to query positions for saved professor:', profUid, posErr)
            const errObj = posErr as { code?: string; message?: string } | null
            const msg = `${errObj?.code || ''} ${errObj?.message || ''}`.toLowerCase()
            if (msg.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('missing or insufficient permissions')) {
              posError = 'permission_denied'
              hasPermissionDenied = true
            } else {
              posError = 'network_error'
              hasNetworkError = true
            }
            positions = []
          }
          const bestScore = positions.length
            ? Math.max(...positions.map((pos) => computeMatch(normalizedStudent, pos).score))
            : 0

          resolved.push({
            uid: profUid,
            username: prof.username || profUid,
            fullName: prof.fullName,
            academicTitle: prof.academicTitle,
            university: prof.university,
            country: prof.country,
            photoURL: prof.photoURL,
            researchAreas: Array.isArray(prof.researchAreas) ? prof.researchAreas : [],
            matchScore: bestScore,
            openPositionsCount: positions.length,
            isRecruiting: Boolean(prof.isRecruiting),
            positionsError: posError,
          })
        }

        if (isMounted) {
          setSaved(resolved)
          setSavedError(hasPermissionDenied ? 'permission_denied' : hasNetworkError ? 'network_error' : null)
        }
      } catch (err: unknown) {
        console.error('Failed to load saved professors from Firestore:', err)
        const errObj = err as { code?: string; message?: string } | null
        const msg = `${errObj?.code || ''} ${errObj?.message || ''}`.toLowerCase()
        if (isMounted) {
          setSaved([])
          setSavedError(
            msg.includes('permission-denied') || msg.includes('permission_denied') || msg.includes('missing or insufficient permissions')
              ? 'permission_denied'
              : 'network_error'
          )
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSavedProfessors()
    return () => {
      isMounted = false
    }
  }, [user])

  const handleRemove = async (uid: string) => {
    const nextList = saved.filter((p) => p.uid !== uid)
    setSaved(nextList)
    if (!user) return
    try {
      await saveStudentSavedProfessors(
        user.uid,
        nextList.map((p) => p.uid)
      )
    } catch (err) {
      console.error('Failed to remove saved professor in Firestore:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading saved faculty…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Bar */}
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
                Saved Faculty & Labs
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Keep track of professors whose ongoing research aligns with your graduate ambitions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {saved.length} Faculty Bookmarked
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/search')}
              className="flex items-center gap-1.5"
            >
              <Search size={14} />
              <span>Explore More</span>
            </Button>
          </div>
        </div>

        {/* Informational Alerts for Permission or Network Issues */}
        {!loading && savedError === 'permission_denied' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">Access Restricted</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Some saved faculty records or positions could not be loaded due to Firestore security permissions.
              </p>
            </div>
          </div>
        )}
        {!loading && savedError === 'network_error' && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">Network Error</h4>
              <p className="text-xs text-red-800 mt-0.5">
                A network issue occurred while loading saved faculty.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {saved.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-2xs max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-500">
              <BookmarkCheck size={32} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-display">No saved professors yet</h2>
            <p className="text-sm text-slate-500">
              When exploring faculty profiles and positions, click the bookmark icon to save professors for quick access here.
            </p>
            <Button onClick={() => navigate('/search')} className="mt-2">
              Browse Faculty Directory
            </Button>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saved.map((prof) => (
              <div
                key={prof.uid}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                id={`saved-card-${prof.uid}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <Avatar src={prof.photoURL} name={prof.fullName} size="md" />
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                          {prof.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{prof.academicTitle}</p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(prof.uid)
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove from saved"
                      id={`remove-saved-${prof.uid}`}
                    >
                      <Heart size={18} className="fill-rose-500" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Building size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{prof.university}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>{prof.country}</span>
                    </div>
                    {prof.positionsError === 'permission_denied' ? (
                      <div className="text-[11px] text-amber-600 font-medium">Positions restricted (permission denied)</div>
                    ) : prof.positionsError === 'network_error' ? (
                      <div className="text-[11px] text-rose-500 font-medium">Positions unavailable</div>
                    ) : prof.openPositionsCount === 0 ? (
                      <div className="text-[11px] text-slate-400 italic">No open positions</div>
                    ) : (
                      <div className="text-[11px] text-blue-600 font-medium">{prof.openPositionsCount} Open Position{prof.openPositionsCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {prof.researchAreas.map((area) => (
                      <span
                        key={area}
                        className="px-2.5 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-700"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Match:</span>
                    <MatchChip score={prof.matchScore} />
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/professor/${prof.username}`)}
                    className="flex items-center gap-1 text-xs font-semibold"
                    id={`view-profile-${prof.username}`}
                  >
                    <span>View Profile</span>
                    <ArrowUpRight size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
