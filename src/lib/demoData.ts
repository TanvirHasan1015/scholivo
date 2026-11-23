import type { ProfessorProfile } from '@/types/user.types'
import type { Position } from '@/types/position.types'

export type ProfessorWithPositions = ProfessorProfile & {
  positions: Position[]
  matchScore?: number
}

export interface SavedProfessorItem {
  uid: string
  fullName: string
  username: string
  academicTitle: string
  department: string
  university: string
  country: string
  photoURL: string
  researchAreas: string[]
  recruitingStatus: 'actively_recruiting' | 'sometimes' | 'not_recruiting'
  matchScore: number
  savedDate: string
  openPositionsCount: number
  fundedPositionsCount: number
}
