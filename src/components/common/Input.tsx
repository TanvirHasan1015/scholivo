import { cn } from '@/utils/helpers'
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-blue-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative w-full">
          {leftIcon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl px-3.5 py-2.5 border transition-all duration-150',
              'border-slate-200 shadow-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
              props.disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  showCount?: boolean
  maxLength?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, showCount, className, id, value, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-blue-600 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          value={value}
          className={cn(
            'w-full bg-white text-slate-900 placeholder:text-slate-400 text-sm rounded-xl px-3.5 py-3 border transition-all duration-150 resize-y min-h-[100px]',
            'border-slate-200 shadow-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
            props.disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
            className
          )}
          {...props}
        />
        <div className="flex items-center justify-between text-xs">
          {error ? (
            <p className="text-red-600 font-medium">{error}</p>
          ) : hint ? (
            <p className="text-slate-500">{hint}</p>
          ) : (
            <span />
          )}
          {showCount && props.maxLength && (
            <span className={cn(charCount > props.maxLength * 0.9 ? 'text-amber-600' : 'text-slate-400')}>
              {charCount}/{props.maxLength}
            </span>
          )}
        </div>
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

// ── Select ────────────────────────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-blue-600 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-white text-slate-900 text-sm rounded-xl px-3.5 py-2.5 border transition-all duration-150 cursor-pointer',
            'border-slate-200 shadow-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-100',
            props.disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
