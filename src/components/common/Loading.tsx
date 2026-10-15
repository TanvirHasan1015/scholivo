import { cn } from '@/utils/helpers'

// ── Spinner ───────────────────────────────────────────────────────────────────

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'primary' | 'accent' | 'white' | 'muted'
}

export function Spinner({ size = 'md', className, color = 'accent' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  const colors = {
    primary: 'text-slate-900',
    accent: 'text-blue-600',
    white: 'text-white',
    muted: 'text-slate-400',
  }

  return (
    <svg
      className={cn('animate-spin', sizes[size], colors[color], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  )
}

// ── Skeleton Placeholder ──────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

export function Skeleton({ className, width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    full: 'rounded-full',
  }

  return (
    <div
      className={cn('skeleton', roundedClasses[rounded], className)}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton width={48} height={48} rounded="full" />
          <div className="space-y-2">
            <Skeleton width={140} height={16} />
            <Skeleton width={100} height={12} />
          </div>
        </div>
        <Skeleton width={80} height={24} rounded="full" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton width="100%" height={14} />
        <Skeleton width="80%" height={14} />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton width={70} height={22} rounded="full" />
        <Skeleton width={90} height={22} rounded="full" />
        <Skeleton width={60} height={22} rounded="full" />
      </div>
    </div>
  )
}

// ── Page Loading State ────────────────────────────────────────────────────────

interface PageLoaderProps {
  message?: string
}

export function PageLoader({ message = 'Loading Scholivo…' }: PageLoaderProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shadow-xs p-1">
          <img src="/scholivo-icon.png" alt="Scholivo" className="w-10 h-10 object-contain animate-pulse" />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">{message}</p>
    </div>
  )
}
