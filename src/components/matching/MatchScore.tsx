import { cn } from '@/utils/helpers'
import { getScoreColor, getScoreLabel } from '@/lib/matching'
import type { MatchResult } from '@/types/match.types'

// ── Match Score Badge (circular) ─────────────────────────────────────────────

interface MatchScoreBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export function MatchScoreBadge({ score, size = 'md', showLabel = false }: MatchScoreBadgeProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  const sizes = {
    sm: { wh: 48, r: 18, stroke: 4, font: '11px' },
    md: { wh: 64, r: 24, stroke: 5, font: '14px' },
    lg: { wh: 88, r: 34, stroke: 6, font: '18px' },
  }

  const { wh, r, stroke, font } = sizes[size]
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: wh, height: wh }}>
        <svg width={wh} height={wh} viewBox={`0 0 ${wh} ${wh}`} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={wh / 2}
            cy={wh / 2}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          {/* Score ring */}
          <circle
            cx={wh / 2}
            cy={wh / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-slate-900"
          style={{ fontSize: font }}
        >
          {score}%
        </span>
      </div>
      {showLabel && (
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  )
}

// ── Match Breakdown Panel ─────────────────────────────────────────────────────

const BREAKDOWN_LABELS = {
  researchInterests: 'Research Interests',
  skills: 'Skills',
  language: 'Language',
  major: 'Major',
  experience: 'Experience',
}

const BREAKDOWN_WEIGHTS = {
  researchInterests: 35,
  skills: 30,
  language: 15,
  major: 10,
  experience: 10,
}

interface MatchBreakdownPanelProps {
  result: MatchResult
}

export function MatchBreakdownPanel({ result }: MatchBreakdownPanelProps) {
  const { breakdown, explanation, matchedKeywords } = result

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
      <div className="flex items-center gap-4">
        <MatchScoreBadge score={result.score} size="lg" showLabel />
        <div className="flex-1">
          <h3 className="text-slate-900 font-display font-bold text-base mb-1">
            Match Analysis
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">{explanation}</p>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3 pt-2">
        {(Object.keys(breakdown) as Array<keyof typeof breakdown>).map((key) => {
          const score = breakdown[key]
          const color = getScoreColor(score)
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-600">
                  {BREAKDOWN_LABELS[key]}
                  <span className="text-slate-400 ml-1">({BREAKDOWN_WEIGHTS[key]}%)</span>
                </span>
                <span className="text-xs font-bold" style={{ color }}>
                  {score}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Matched keywords */}
      {matchedKeywords.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
            Matched Terms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchedKeywords.slice(0, 8).map((kw) => (
              <span key={kw} className="tag text-xs">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline Match Score Chip ───────────────────────────────────────────────────

export function MatchChip({ score }: { score: number }) {
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
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs',
        colorClass
      )}
    >
      {score}% Match
    </span>
  )
}
