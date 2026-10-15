export type DegreeType = 'Master' | 'PhD' | 'Research_Assistant' | 'PostDoc'
export type FundingType = 'fully_funded' | 'partially_funded' | 'self_funded' | 'scholarship'

export interface LanguageRequirement {
  type: string
  minimumScore: string
}

export interface Position {
  id: string
  professorId: string
  professorName: string
  professorTitle: string
  professorPhotoURL?: string
  university: string
  department: string
  country: string

  title: string
  degreeType: DegreeType
  description: string
  researchArea: string
  researchTopics: string[]

  requiredSkills: string[]
  preferredSkills: string[]
  minimumGPA: number
  gpaScale: number
  languageRequirements: LanguageRequirement[]
  otherRequirements: string

  fundingType: FundingType
  fundingDetails?: string
  stipend?: string

  applicationDeadline: string
  startDate?: string

  isOpen: boolean
  createdAt: string
  updatedAt: string
}
