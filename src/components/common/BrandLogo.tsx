import { Link } from 'react-router-dom'
import { cn } from '@/utils/helpers'

interface BrandLogoProps {
  className?: string
  iconSize?: 'sm' | 'md' | 'lg' | 'xl'
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  showTagline?: boolean
  variant?: 'light' | 'dark'
  to?: string
}

export function BrandLogo({
  className,
  iconSize = 'md',
  textSize = 'md',
  showText = true,
  showTagline = false,
  variant = 'light',
  to = '/',
}: BrandLogoProps) {
  const iconDimensions = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
    xl: 'h-14 w-14',
  }

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }

  const content = (
    <div className={cn('inline-flex items-center gap-2.5 shrink-0 select-none group', className)}>
      {/* Official Scholivo Emblem */}
      <div
        className={cn(
          'relative rounded-xl overflow-hidden flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0',
          variant === 'dark' ? 'bg-white p-1 shadow-sm' : 'bg-transparent'
        )}
      >
        <img
          src="/scholivo-icon.png"
          alt="Scholivo Logo"
          className={cn('object-contain', iconDimensions[iconSize])}
        />
      </div>

      {/* Official Scholivo Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none justify-center">
          <span
            className={cn(
              'font-display font-extrabold tracking-tight',
              textSizes[textSize],
              variant === 'dark' ? 'text-white' : 'text-[#0b2545]'
            )}
          >
            Scholivo
          </span>
          {showTagline && (
            <span
              className={cn(
                'text-[10px] font-medium tracking-wide mt-1',
                variant === 'dark' ? 'text-slate-400' : 'text-slate-500'
              )}
            >
              Academic Opportunities, Connected.
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center focus:outline-none" aria-label="Scholivo Home">
        {content}
      </Link>
    )
  }

  return content
}
