import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'muted' | 'dark'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      interactive = false,
      padding = 'md',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'bg-white border border-slate-200 shadow-2xs',
      elevated: 'bg-white border border-slate-200 shadow-md',
      outlined: 'bg-white border border-slate-200',
      muted: 'bg-slate-50 border border-slate-200/80',
      dark: 'bg-slate-900 border border-slate-800 text-white shadow-xl',
    }

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-200',
          variants[variant],
          paddings[padding],
          interactive &&
            'cursor-pointer hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1.5 mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-lg font-bold text-slate-900 tracking-tight',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-slate-500 leading-relaxed', className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
