import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MapPin, Building, ArrowLeft, BookmarkCheck, Search, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { MatchChip } from '@/components/matching/MatchScore'
import type { SavedProfessorItem } from '@/lib/demoData'

export default function SavedProfessors() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState<SavedProfessorItem[]>([])

  const handleRemove = (uid: string) => {
    setSaved((prev) => prev.filter((p) => p.uid !== uid))
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

        {/* Empty State */}
        {saved.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-2xs max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-500">
              <BookmarkCheck size={32} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-display">No saved professors yet</h2>
            <p className="text-sm text-slate-500">
              When exploring faculty profiles and positions, bookmark professors to keep track of them here.
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
