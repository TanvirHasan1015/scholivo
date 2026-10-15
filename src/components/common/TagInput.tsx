import { cn } from '@/utils/helpers'
import { X, Plus } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

interface TagInputProps {
  label?: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  error?: string
  hint?: string
  maxTags?: number
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
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = suggestions
    .filter(
      (s) =>
        s.toLowerCase().includes(input.toLowerCase()) &&
        !tags.includes(s) &&
        input.length > 0
    )
    .slice(0, 6)

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tags.includes(trimmed) && (!maxTags || tags.length < maxTags)) {
      onChange([...tags, trimmed])
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
          {label}
          {maxTags && <span className="text-slate-400 font-normal ml-2 lowercase">({tags.length}/{maxTags})</span>}
        </label>
      )}
      <div
        className={cn(
          'w-full bg-white text-slate-900 border border-slate-200 rounded-xl px-3 py-2 min-h-[44px] flex flex-wrap gap-1.5 items-center transition-all duration-150',
          'focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100',
          error && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100'
        )}
        onClick={() => document.getElementById('tag-input-inner')?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="text-blue-500 hover:text-blue-900 transition-colors cursor-pointer"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          id="tag-input-inner"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKey}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg z-20 mt-1">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => addTag(s)}
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
