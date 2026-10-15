import { cn } from '@/utils/helpers'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.99]'

    const variants = {
      primary:
        'bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 hover:border-slate-800 shadow-xs',
      accent:
        'bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 hover:border-blue-700 shadow-xs',
      secondary:
        'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-xs',
      outline:
        'bg-transparent border border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700',
      ghost:
        'bg-transparent text-slate-600 border border-transparent hover:text-slate-900 hover:bg-slate-100',
      danger:
        'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg',
      md: 'px-4 py-2 text-sm rounded-xl',
      lg: 'px-6 py-2.5 text-base rounded-xl font-semibold',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
