import type {
  ProfessorFundingAvailabilityStatus,
  ProfessorFundingInfo,
  ProfessorFundingSourceType,
} from '@/types/user.types'

export const PROFESSOR_FUNDING_TYPE_OPTIONS: {
  id: ProfessorFundingSourceType
  label: string
}[] = [
  { id: 'government', label: 'Government-funded research' },
  { id: 'university', label: 'University-funded research' },
  { id: 'industry', label: 'Industry-sponsored research' },
  { id: 'national_international_grants', label: 'National or international research grants' },
  { id: 'self_funded', label: 'Self-funded research' },
  { id: 'other', label: 'Other' },
]

export const PROFESSOR_FUNDING_TYPE_LABELS: Record<ProfessorFundingSourceType, string> = {
  government: 'Government-funded research',
  university: 'University-funded research',
  industry: 'Industry-sponsored research',
  national_international_grants: 'National or international research grants',
  self_funded: 'Self-funded research',
  other: 'Other',
}

export const PROFESSOR_FUNDING_STATUS_OPTIONS: {
  id: ProfessorFundingAvailabilityStatus
  label: string
}[] = [
  { id: 'currently_funded', label: 'Currently funded' },
  { id: 'funding_available_for_new_students', label: 'Funding available for new students' },
  { id: 'funding_available_for_selected_positions', label: 'Funding available for selected positions only' },
  { id: 'seeking_additional_funding', label: 'Seeking additional funding' },
  { id: 'no_current_funding', label: 'No current funding' },
]

export const PROFESSOR_FUNDING_STATUS_LABELS: Record<ProfessorFundingAvailabilityStatus, string> = {
  currently_funded: 'Currently funded',
  funding_available_for_new_students: 'Funding available for new students',
  funding_available_for_selected_positions: 'Funding available for selected positions only',
  seeking_additional_funding: 'Seeking additional funding',
  no_current_funding: 'No current funding',
}

export function getFundingStatusBadgeStyle(status?: ProfessorFundingAvailabilityStatus | ''): string {
  switch (status) {
    case 'funding_available_for_new_students':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'currently_funded':
      return 'bg-teal-50 text-teal-700 border-teal-200'
    case 'funding_available_for_selected_positions':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'seeking_additional_funding':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'no_current_funding':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

export function createEmptyProfessorFundingInfo(): ProfessorFundingInfo {
  return {
    fundingTypes: [],
    otherFundingTypeExplanation: '',
    fundingStatus: '',
    description: '',
    supportedStudentsCount: null,
    eligibilityRequirements: '',
    additionalNotes: '',
  }
}

export function normalizeProfessorFundingInfo(
  raw?: Partial<ProfessorFundingInfo> | null
): ProfessorFundingInfo {
  const base = createEmptyProfessorFundingInfo()
  if (!raw || typeof raw !== 'object') return base

  const allowedTypes = new Set<string>(PROFESSOR_FUNDING_TYPE_OPTIONS.map((o) => o.id))
  const allowedStatuses = new Set<string>(PROFESSOR_FUNDING_STATUS_OPTIONS.map((o) => o.id))

  const fundingTypes = Array.isArray(raw.fundingTypes)
    ? raw.fundingTypes.filter((t): t is ProfessorFundingSourceType => typeof t === 'string' && allowedTypes.has(t))
    : []

  const fundingStatus =
    typeof raw.fundingStatus === 'string' && allowedStatuses.has(raw.fundingStatus)
      ? (raw.fundingStatus as ProfessorFundingAvailabilityStatus)
      : ''

  const supportedStudentsCount =
    typeof raw.supportedStudentsCount === 'number' &&
    !Number.isNaN(raw.supportedStudentsCount) &&
    raw.supportedStudentsCount >= 0
      ? Math.floor(raw.supportedStudentsCount)
      : null

  return {
    fundingTypes,
    otherFundingTypeExplanation:
      typeof raw.otherFundingTypeExplanation === 'string' ? raw.otherFundingTypeExplanation : '',
    fundingStatus,
    description: typeof raw.description === 'string' ? raw.description : '',
    supportedStudentsCount,
    eligibilityRequirements:
      typeof raw.eligibilityRequirements === 'string' ? raw.eligibilityRequirements : '',
    additionalNotes: typeof raw.additionalNotes === 'string' ? raw.additionalNotes : '',
  }
}

export function hasProfessorFundingInfo(info?: ProfessorFundingInfo | null): boolean {
  if (!info || typeof info !== 'object') return false
  return Boolean(
    (Array.isArray(info.fundingTypes) && info.fundingTypes.length > 0) ||
      (info.fundingStatus && info.fundingStatus.trim().length > 0) ||
      (info.description && info.description.trim().length > 0) ||
      (typeof info.supportedStudentsCount === 'number' && !Number.isNaN(info.supportedStudentsCount)) ||
      (info.eligibilityRequirements && info.eligibilityRequirements.trim().length > 0) ||
      (info.additionalNotes && info.additionalNotes.trim().length > 0)
  )
}
