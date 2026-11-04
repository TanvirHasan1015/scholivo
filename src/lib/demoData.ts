import type { ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'

export type ProfessorWithPositions = ProfessorProfile & {
  positions: Position[]
  matchScore?: number
}

export interface SavedProfessorItem {
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
}
