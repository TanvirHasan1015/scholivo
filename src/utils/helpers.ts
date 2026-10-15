import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatRelativeDate(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diff = now.getTime() - then.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export function normalizeGPA(gpa: number, scale: number): number {
  return Math.min((gpa / scale) * 4, 4)
}

export const RESEARCH_AREAS = [
  'Artificial Intelligence',
  'Machine Learning',
  'Deep Learning',
  'Computer Vision',
  'Natural Language Processing',
  'Robotics',
  'Human-Computer Interaction',
  'Data Science',
  'Cybersecurity',
  'Computer Networks',
  'Distributed Systems',
  'Software Engineering',
  'Bioinformatics',
  'Computational Biology',
  'Signal Processing',
  'Control Systems',
  'Power Systems',
  'Materials Science',
  'Quantum Computing',
  'Nanotechnology',
  'Environmental Science',
  'Climate Science',
  'Economics',
  'Education Technology',
  'Medical Informatics',
  'Other',
]

export const COUNTRIES = [
  'South Korea', 'United States', 'United Kingdom', 'Germany', 'Japan',
  'Canada', 'Australia', 'France', 'Netherlands', 'Singapore',
  'China', 'India', 'Switzerland', 'Sweden', 'Denmark',
  'Norway', 'Finland', 'Belgium', 'Austria', 'Spain',
  'Italy', 'Portugal', 'Poland', 'Czech Republic', 'Hungary',
  'Bangladesh', 'Pakistan', 'Sri Lanka', 'Nepal', 'Other',
]

export const DEGREES = ['Bachelor', 'Master', 'PhD'] as const
export const DEGREE_TYPES = ['Master', 'PhD', 'Research_Assistant', 'PostDoc'] as const

export const FUNDING_LABELS: Record<string, string> = {
  fully_funded: 'Fully Funded',
  partially_funded: 'Partially Funded',
  self_funded: 'Self-Funded',
  scholarship: 'Scholarship',
}

export const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export const RECRUITING_STATUS_LABELS: Record<string, string> = {
  actively_recruiting: 'Actively Recruiting',
  sometimes: 'Occasionally Recruiting',
  not_recruiting: 'Not Recruiting',
}

import type { StudentProfile } from '@/types/user.types'

export function calculateProfileCompleteness(profile?: Partial<StudentProfile> | null): number {
  if (!profile) return 0
  let score = 0
  if (profile.fullName && profile.email) score += 15
  if (profile.university && profile.major && profile.degree) score += 20
  if (profile.gpa && profile.expectedGraduation) score += 15
  if (profile.researchInterests && profile.researchInterests.length > 0) score += 20
  if ((profile.programmingLanguages && profile.programmingLanguages.length > 0) || (profile.technicalSkills && profile.technicalSkills.length > 0)) score += 15
  if (profile.languageScores && profile.languageScores.length > 0) score += 5
  if (profile.cvUrl || profile.transcriptUrl) score += 10
  return Math.min(score, 100)
}
