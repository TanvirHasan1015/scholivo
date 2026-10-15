export interface MatchBreakdown {
  researchInterests: number
  skills: number
  language: number
  major: number
  experience: number
}

export interface MatchResult {
  score: number
  breakdown: MatchBreakdown
  explanation: string
  matchedKeywords: string[]
}
