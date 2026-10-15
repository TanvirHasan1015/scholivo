import { CheckCircle2, Shield, Clock, XCircle, Sparkles } from 'lucide-react'
import type { VerificationStatus, RecruitingStatus } from '@/types/user.types'
import { RECRUITING_STATUS_LABELS, cn } from '@/utils/helpers'

// ── Verification Badge ────────────────────────────────────────────────────────

interface VerificationBadgeProps {
  status: VerificationStatus
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const verificationConfig = {
  verified: {
    label: 'Verified Faculty',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    iconClassName: 'text-emerald-600',
  },
  pending: {
    label: 'Verification Pending',
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
    iconClassName: 'text-amber-600',
  },
  more_info_required: {
    label: 'Needs More Info',
    icon: Clock,
    className: 'bg-purple-50 text-purple-700 border-purple-200 font-medium',
    iconClassName: 'text-purple-600',
  },
  rejected: {
    label: 'Verification Rejected',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200 font-medium',
    iconClassName: 'text-red-600',
  },
  unsubmitted: {
    label: 'Not Verified',
    icon: Shield,
    className: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    iconClassName: 'text-slate-400',
  },
  unverified: {
    label: 'Unverified',
    icon: Shield,
    className: 'bg-slate-100 text-slate-600 border-slate-200 font-medium',
    iconClassName: 'text-slate-400',
  },
}

export function VerificationBadge({
  status,
  showLabel = true,
  size = 'sm',
  className,
}: VerificationBadgeProps) {
  const current = verificationConfig[status] || verificationConfig.unsubmitted
  const Icon = current.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        current.className,
        className
      )}
    >
      <Icon size={size === 'sm' ? 13 : 15} className={current.iconClassName} />
      {showLabel && current.label}
    </span>
  )
}

// ── Recruiting Status Badge ───────────────────────────────────────────────────

interface RecruitingBadgeProps {
  status: RecruitingStatus
  className?: string
}

export function RecruitingBadge({ status, className }: RecruitingBadgeProps) {
  const styles = {
    actively_recruiting: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sometimes: 'bg-amber-50 text-amber-700 border-amber-200',
    not_recruiting: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  const dotStyles = {
    actively_recruiting: 'bg-emerald-500 pulse-dot',
    sometimes: 'bg-amber-500',
    not_recruiting: 'bg-slate-400',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-2xs',
        styles[status],
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotStyles[status])} />
      {RECRUITING_STATUS_LABELS[status] || 'Recruiting'}
    </span>
  )
}

// ── Match Score Pill ──────────────────────────────────────────────────────────

interface MatchPillProps {
  score: number
  prefix?: string
  showSparkle?: boolean
  className?: string
}

export function MatchPill({ score, prefix = '', showSparkle = false, className }: MatchPillProps) {
  const isHigh = score >= 80
  const isMid = score >= 60

  const colorClass = isHigh
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : isMid
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs',
        colorClass,
        className
      )}
    >
      {showSparkle && <Sparkles size={11} className="text-emerald-600" />}
      {prefix && <span>{prefix}</span>}
      <span>{score}% Match</span>
    </span>
  )
}

// ── Application Status Badge ──────────────────────────────────────────────────

export interface ApplicationStatusBadgeProps {
  status: 'submitted' | 'under_review' | 'shortlisted' | 'interview_scheduled' | 'accepted' | 'rejected'
  className?: string
}

const statusConfig: Record<ApplicationStatusBadgeProps['status'], { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'status-submitted' },
  under_review: { label: 'Under Review', className: 'status-review' },
  shortlisted: { label: 'Shortlisted', className: 'status-shortlisted' },
  interview_scheduled: { label: 'Interview Scheduled', className: 'status-interview' },
  accepted: { label: 'Accepted', className: 'status-accepted' },
  rejected: { label: 'Rejected', className: 'status-rejected' },
}

export function ApplicationStatusBadge({ status, className }: ApplicationStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.submitted

  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  )
}
