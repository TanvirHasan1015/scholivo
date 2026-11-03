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

  // Account Status
  accountStatus?: AccountStatus

  // Meta
  profileCompleteness: number
  bio?: string
  createdAt: string
  updatedAt: string
}

// ── Account & Recruiting Status ───────────────────────────────────────────────

export type AccountStatus = 'active' | 'suspended' | 'banned'

export type RecruitingStatus = 'actively_recruiting' | 'sometimes' | 'not_recruiting'

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
  email: string
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

  // Account Status
  accountStatus?: AccountStatus

  // Recruiting
  isRecruiting: boolean
  recruitingStatus: RecruitingStatus

  // Meta
  createdAt: string
  updatedAt: string
}
