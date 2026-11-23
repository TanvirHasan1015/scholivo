import { cn } from '@/utils/helpers'
import { X, Plus } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  label?: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  error?: string
  hint?: string
  maxTags?: number
  disabled?: boolean
}

export function TagInput({
  label,
  tags,
  onChange,
  placeholder = 'Type and press Enter',
  suggestions = [],
  error,
  hint,
  maxTags,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const safeTags = Array.isArray(tags) ? tags : []

  const hasDuplicate = (candidate: string, list: string[]) => {
    const norm = candidate.trim().toLowerCase()
    return list.some((t) => t.trim().toLowerCase() === norm)
  }

  const filteredSuggestions = suggestions
    .filter(
      (s) =>
        s.toLowerCase().includes(input.toLowerCase()) &&
        !hasDuplicate(s, safeTags) &&
        input.trim().length > 0
    )
    .slice(0, 6)

  const commitRawInput = (raw: string) => {
    if (disabled) return
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length === 0) {
      setInput('')
      setShowSuggestions(false)
      return
    }

    const next = [...safeTags]
    for (const part of parts) {
      if (maxTags && next.length >= maxTags) break
      if (!hasDuplicate(part, next)) {
        next.push(part)
      }
    }

    if (next.length !== safeTags.length) {
      onChange(next)
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tagToRemove: string) => {
    if (disabled) return
    onChange(safeTags.filter((t) => t !== tagToRemove))
  }

  const editTag = (tagToEdit: string) => {
    if (disabled) return
    onChange(safeTags.filter((t) => t !== tagToEdit))
    setInput(tagToEdit)
    inputRef.current?.focus()
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) {
        commitRawInput(input)
      }
    } else if (e.key === 'Backspace' && !input && safeTags.length > 0) {
      removeTag(safeTags[safeTags.length - 1])
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-slate-700 tracking-wide uppercase"
        >
          {label}
          {maxTags && (
            <span className="text-slate-400 font-normal ml-2 lowercase">
              ({safeTags.length}/{maxTags})
            </span>
          )}
        </label>
      )}
      <div
        className={cn(
          'w-full bg-white text-slate-900 border border-slate-200 rounded-xl px-3 py-2 min-h-[44px] flex flex-wrap gap-1.5 items-center transition-all duration-150',
          'focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100',
          disabled && 'bg-slate-50 opacity-75 cursor-not-allowed',
          error && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100'
        )}
        onClick={() => {
          if (!disabled) inputRef.current?.focus()
        }}
      >
        {safeTags.map((tag) => (
          <span
            key={tag}
            onClick={(e) => {
              e.stopPropagation()
              editTag(tag)
            }}
            title={disabled ? tag : 'Click to edit tag, or click × to remove'}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200',
              !disabled && 'cursor-pointer hover:bg-blue-100/80 transition-colors'
            )}
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                aria-label={`Remove ${tag}`}
                className="text-blue-500 hover:text-blue-900 transition-colors cursor-pointer p-0.5"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <div className="flex-1 flex items-center gap-1.5 min-w-[160px]">
            <input
              ref={inputRef}
              id={inputId}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setShowSuggestions(true)
              }}
              onKeyDown={handleKey}
              onBlur={() => {
                setTimeout(() => {
                  setShowSuggestions(false)
                }, 150)
                if (input.trim()) {
                  commitRawInput(input)
                }
              }}
              placeholder={safeTags.length === 0 ? placeholder : 'Add another…'}
              className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
            />
            {input.trim().length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitRawInput(input)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  commitRawInput(input)
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {!disabled && showSuggestions && filteredSuggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg z-20 mt-1">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                commitRawInput(s)
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus size={13} className="text-blue-600" />
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
