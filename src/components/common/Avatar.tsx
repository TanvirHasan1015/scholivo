import { cn, getInitials } from '@/utils/helpers'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base font-semibold',
  xl: 'h-20 w-20 text-xl font-bold',
}

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover border border-slate-200 shadow-2xs shrink-0', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium border border-slate-200 shadow-2xs shrink-0',
        'bg-slate-100 text-slate-700',
        sizes[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
