// ── Shared Sub-types ─────────────────────────────────────────────────────────

export interface ResearchExperience {
  id: string
  title: string
  organization: string
  role: string
  startDate: string
  endDate?: string
  isCurrent: boolean
  description: string
}

export interface Project {
  id: string
  title: string
  description: string
  url?: string
  technologies: string[]
}

export interface Publication {
  id: string
  title: string
  journal?: string
  conference?: string
  year: number
  url?: string
  doi?: string
  authors: string[]
}

export interface LanguageScore {
  id: string
  type: 'IELTS' | 'TOEFL' | 'TOPIK' | 'GRE' | 'GMAT' | 'Other'
  score: string
  date?: string
  label?: string // For "Other" type
}

// ── User (Shared) ─────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'professor'

export interface BaseUser {
  uid: string
  email: string
  displayName: string
  username: string
  role: UserRole
  photoURL?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ── Student ───────────────────────────────────────────────────────────────────

export interface StudentProfile {
  // Account
  uid: string
  fullName: string
  username: string
  email: string
  universityEmail?: string
  country: string
  photoURL?: string

  // Academic
  university: string
  department: string
  major: string
  degree: 'Bachelor' | 'Master' | 'PhD'
  currentSemester: string
  expectedGraduation: string
  gpa: number
  gpaScale: number

  // Research
  researchInterests: string[]
  researchAreas: string[]
  researchExperience: ResearchExperience[]
  projects: Project[]
  publications: Publication[]

  // Skills
  programmingLanguages: string[]
  frameworks: string[]
  technicalSkills: string[]
  researchTools: string[]

  // Language
  languageScores: LanguageScore[]

  // Documents
  cvUrl?: string
  transcriptUrl?: string
  portfolioUrl?: string

  // Saved / Bookmarked Professors
  savedProfessorIds?: string[]

  // Meta
  profileCompleteness: number
  bio?: string
  createdAt: string
  updatedAt: string
}

// ── Professor ─────────────────────────────────────────────────────────────────

export type RecruitingStatus = 'actively_recruiting' | 'sometimes' | 'not_recruiting'

export type ProfessorFundingSourceType =
  | 'government'
  | 'university'
  | 'industry'
  | 'national_international_grants'
  | 'self_funded'
  | 'other'

export type ProfessorFundingAvailabilityStatus =
  | 'currently_funded'
  | 'funding_available_for_new_students'
  | 'funding_available_for_selected_positions'
  | 'seeking_additional_funding'
  | 'no_current_funding'

export interface ProfessorFundingInfo {
  fundingTypes: ProfessorFundingSourceType[]
  otherFundingTypeExplanation?: string
  fundingStatus?: ProfessorFundingAvailabilityStatus | ''
  description?: string
  supportedStudentsCount?: number | null
  eligibilityRequirements?: string
  additionalNotes?: string
}

export interface ResearchProject {
  id: string
  title: string
  description: string
  fundingSource?: string
  startDate?: string
  endDate?: string
  isOngoing: boolean
}

export interface LabMember {
  id: string
  name: string
  role: string
  photoURL?: string
}

export interface ProfessorProfile {
  uid: string
  fullName: string
  username: string
  email?: string
  isPublicProfile?: boolean
  academicTitle: string
  country: string
  photoURL?: string

  // Affiliation
  university: string
  department: string
  faculty: string

  // Web Presence
  universityProfileUrl?: string
  googleScholarUrl?: string
  orcid?: string
  personalWebpageUrl?: string

  // Academic Content
  biography: string
  researchAreas: string[]
  researchInterests: string[]
  currentProjects: ResearchProject[]
  publications: Publication[]

  // Lab
  labName?: string
  labDescription?: string
  labWebsiteUrl?: string
  labMembers?: LabMember[]

  // Recruiting & Funding Availability
  isRecruiting: boolean
  recruitingStatus: RecruitingStatus
  fundingInfo?: ProfessorFundingInfo

  // Meta
  createdAt: string
  updatedAt: string
}
