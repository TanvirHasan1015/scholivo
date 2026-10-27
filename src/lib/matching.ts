import type { MatchBreakdown, MatchResult } from '@/types/match.types'
import type { Position } from '@/types/position.types'
import type { StudentProfile } from '@/types/user.types'

// ── Jaccard Similarity ────────────────────────────────────────────────────────

function jaccardSimilarity(setA: string[], setB: string[]): number {
  const safeA = setA ?? []
  const safeB = setB ?? []
  if (safeA.length === 0 && safeB.length === 0) return 1
  if (safeA.length === 0 || safeB.length === 0) return 0

  const normalizeTerms = (terms: string[]) =>
    terms.filter(Boolean).map((t) => t.toLowerCase().trim())

  const a = new Set(normalizeTerms(safeA))
  const b = new Set(normalizeTerms(safeB))

  // Also count partial substring matches (e.g. "CV" matches "Computer Vision")
  let intersectionCount = 0
  const matched: string[] = []

  a.forEach((aItem) => {
    b.forEach((bItem) => {
      if (
        aItem === bItem ||
        bItem.includes(aItem) ||
        aItem.includes(bItem)
      ) {
        intersectionCount++
        matched.push(bItem)
      }
    })
  })

  const unionCount = a.size + b.size - intersectionCount
  return unionCount > 0 ? Math.min(intersectionCount / unionCount, 1) : 0
}

// ── Research Interests Score (35%) ────────────────────────────────────────────

function scoreResearchInterests(student: StudentProfile, position: Position): { score: number; matched: string[] } {
  const studentTerms = [...(student.researchInterests ?? []), ...(student.researchAreas ?? [])]
  const positionTerms = [
    ...(position.researchTopics ?? []),
    ...(position.researchArea ? [position.researchArea] : []),
  ]

  const normalized = (terms: string[]) => terms.filter(Boolean).map((t) => t.toLowerCase().trim())
  const sNorm = normalized(studentTerms)
  const pNorm = normalized(positionTerms)

  const matched: string[] = []
  pNorm.forEach((pt) => {
    sNorm.forEach((st) => {
      if (pt.includes(st) || st.includes(pt) || pt === st) {
        if (!matched.includes(pt)) matched.push(pt)
      }
    })
  })

  const score = jaccardSimilarity(studentTerms, positionTerms)
  return { score: Math.min(score * 1.2, 1), matched } // slight boost for research focus
}

// ── Skills Score (30%) ────────────────────────────────────────────────────────

function scoreSkills(student: StudentProfile, position: Position): { score: number; matched: string[] } {
  const studentSkills = [
    ...(student.programmingLanguages ?? []),
    ...(student.frameworks ?? []),
    ...(student.technicalSkills ?? []),
    ...(student.researchTools ?? []),
  ]

  const normalized = (terms: string[]) => terms.filter(Boolean).map((t) => t.toLowerCase().trim())
  const sSkills = normalized(studentSkills)
  const required = normalized(position.requiredSkills ?? [])
  const preferred = normalized(position.preferredSkills ?? [])

  const matched: string[] = []
  let requiredScore = 0
  let preferredScore = 0

  required.forEach((req) => {
    if (sSkills.some((s) => s.includes(req) || req.includes(s))) {
      requiredScore++
      matched.push(req)
    }
  })

  preferred.forEach((pref) => {
    if (sSkills.some((s) => s.includes(pref) || pref.includes(s))) {
      preferredScore++
      if (!matched.includes(pref)) matched.push(pref)
    }
  })

  const reqWeight = required.length > 0 ? requiredScore / required.length : 0.7
  const prefWeight = preferred.length > 0 ? (preferredScore / preferred.length) * 0.5 : 0.35

  const score = required.length > 0 ? reqWeight * 0.7 + prefWeight * 0.3 : 0.5

  return { score: Math.min(score, 1), matched }
}

// ── Language Score (15%) ──────────────────────────────────────────────────────

function scoreLanguage(student: StudentProfile, position: Position): number {
  const requirements = position.languageRequirements ?? []
  if (!requirements || requirements.length === 0) return 1

  let total = 0
  let count = 0

  const studentScores = student.languageScores ?? []

  requirements.forEach((req) => {
    const studentScore = studentScores.find(
      (ls) => ls?.type && req?.type && ls.type.toLowerCase() === req.type.toLowerCase()
    )

    if (!studentScore) {
      total += 0.3 // Unknown — gives partial credit
    } else {
      const required = parseFloat(req.minimumScore) || 0
      const actual = parseFloat(studentScore.score) || 0

      if (actual >= required) {
        total += 1
      } else {
        total += Math.max(0.3, actual / required)
      }
    }
    count++
  })

  return count > 0 ? total / count : 1
}

// ── Major Score (10%) ─────────────────────────────────────────────────────────

const FIELD_GROUPS: Record<string, string[]> = {
  'computer science': ['cs', 'computing', 'software', 'ai', 'artificial intelligence', 'machine learning', 'data science'],
  'electrical engineering': ['ee', 'electronics', 'signal processing', 'communications'],
  'mechanical engineering': ['me', 'robotics', 'mechatronics'],
  'mathematics': ['math', 'statistics', 'applied math'],
  'physics': ['applied physics', 'computational physics'],
  'biology': ['bioinformatics', 'biomedical', 'biotechnology'],
}

function scoreMajor(student: StudentProfile, position: Position): number {
  const studentMajor = (student.major ?? '').toLowerCase()
  const positionArea = (position.researchArea ?? '').toLowerCase()

  if (!studentMajor || !positionArea) return 0.2

  // Exact match
  if (studentMajor.includes(positionArea) || positionArea.includes(studentMajor)) return 1

  // Same broad field
  for (const group of Object.values(FIELD_GROUPS)) {
    const inGroup = (term: string) => group.some((g) => term.includes(g)) || group.includes(term)
    if (inGroup(studentMajor) && inGroup(positionArea)) return 0.75
  }

  // Cross-disciplinary similarity (partial)
  const studentWords = studentMajor.split(/\s+/).filter(Boolean)
  const positionWords = positionArea.split(/\s+/).filter(Boolean)
  const overlap = studentWords.filter((w) => positionWords.includes(w) && w.length > 3)
  if (overlap.length > 0) return 0.5

  return 0.2
}

// ── Experience Score (10%) ────────────────────────────────────────────────────

function scoreExperience(student: StudentProfile): number {
  const expCount = (student.researchExperience ?? []).length
  const pubCount = (student.publications ?? []).length
  const projectCount = (student.projects ?? []).length

  let score = 0

  // Research experience
  if (expCount === 0) score += 0.2
  else if (expCount === 1) score += 0.5
  else if (expCount === 2) score += 0.7
  else score += 0.9

  // Publications bonus
  if (pubCount >= 2) score = Math.min(score + 0.15, 1)
  else if (pubCount === 1) score = Math.min(score + 0.08, 1)

  // Projects partial credit
  if (projectCount >= 2) score = Math.min(score + 0.05, 1)

  return Math.min(score, 1)
}

// ── Explanation Generator ─────────────────────────────────────────────────────

function generateExplanation(
  matchedResearch: string[],
  matchedSkills: string[],
  breakdown: MatchBreakdown
): string {
  const parts: string[] = []

  const safeResearch = matchedResearch ?? []
  const safeSkills = matchedSkills ?? []

  if (safeResearch.length > 0) {
    const top = safeResearch.slice(0, 3).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()))
    parts.push(`Strong research overlap in ${top.join(', ')}.`)
  } else {
    parts.push('Limited research interest overlap detected.')
  }

  if (safeSkills.length > 0) {
    const top = safeSkills.slice(0, 4).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()))
    parts.push(`Matching skills: ${top.join(', ')}.`)
  }

  if (breakdown.language >= 0.9) {
    parts.push('Language requirements are met or exceeded.')
  } else if (breakdown.language < 0.6) {
    parts.push('Language scores may not meet all requirements.')
  }

  if (breakdown.experience >= 0.8) {
    parts.push('Relevant research experience and publications strengthen this application.')
  } else if (breakdown.experience < 0.4) {
    parts.push('Building more research experience would improve this match.')
  }

  return parts.join(' ')
}

// ── Main Matching Function ────────────────────────────────────────────────────

export function computeMatch(student: StudentProfile, position: Position): MatchResult {
  const { score: riScore, matched: matchedResearch } = scoreResearchInterests(student, position)
  const { score: skillScore, matched: matchedSkills } = scoreSkills(student, position)
  const langScore = scoreLanguage(student, position)
  const majorScore = scoreMajor(student, position)
  const expScore = scoreExperience(student)

  const breakdown: MatchBreakdown = {
    researchInterests: Math.round(riScore * 100),
    skills: Math.round(skillScore * 100),
    language: Math.round(langScore * 100),
    major: Math.round(majorScore * 100),
    experience: Math.round(expScore * 100),
  }

  const totalScore =
    riScore * 0.35 +
    skillScore * 0.30 +
    langScore * 0.15 +
    majorScore * 0.10 +
    expScore * 0.10

  const score = Math.round(Math.min(totalScore * 100, 100))
  const allMatched = [...new Set([...matchedResearch, ...matchedSkills])]
  const explanation = generateExplanation(matchedResearch, matchedSkills, breakdown)

  return { score, breakdown, explanation, matchedKeywords: allMatched }
}

// ── Score Color Helper ────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 85) return '#10b981' // green
  if (score >= 70) return '#6366f1' // brand
  if (score >= 55) return '#f59e0b' // amber
  return '#ef4444'                   // red
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent Match'
  if (score >= 70) return 'Good Match'
  if (score >= 55) return 'Moderate Match'
  return 'Low Match'
}
