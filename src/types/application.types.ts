export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'accepted'
  | 'rejected'

export interface StatusEvent {
  status: ApplicationStatus
  changedAt: string
  note?: string
}

export interface Application {
  id: string
  studentId: string
  studentName: string
  studentPhotoURL?: string
  professorId: string
  positionId: string
  positionTitle: string
  professorName: string
  university: string

  matchScore: number
  matchBreakdown: {
    researchInterests: number
    skills: number
    language: number
    major: number
    experience: number
  }
  matchExplanation: string

  cvUrl: string
  transcriptUrl?: string
  applicationStatement: string

  status: ApplicationStatus
  statusHistory: StatusEvent[]

  submittedAt: string
  updatedAt: string
}
