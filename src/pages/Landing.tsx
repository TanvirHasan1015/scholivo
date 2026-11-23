import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Sparkles,
  ArrowRight,
  Check,
  GraduationCap,
  ShieldCheck,
  MessageSquare,
  Eye,
  Cpu,
  Bot,
  Shield,
  BarChart3,
  Users,
  ChevronRight,
  BookOpen,
  DollarSign,
  CheckCircle2,
  Briefcase,
  Link2,
} from 'lucide-react'
import { fetchPublicProfessorsSafely } from '@/lib/messaging'
import {
  PROFESSOR_FUNDING_STATUS_LABELS,
  getFundingStatusBadgeStyle,
  normalizeProfessorFundingInfo,
} from '@/lib/professorFunding'
import type { ProfessorProfile } from '@/types/user.types'
import { Button } from '@/components/common/Button'
import { Avatar } from '@/components/common/Avatar'
import { RecruitingBadge } from '@/components/common/Badges'

// ── Illustrative Demo Profiles (Static UI Preview Only — Never Written to Firestore) ──

const DEMO_STUDENT = {
  name: 'Alex Morgan',
  initials: 'AM',
  role: 'Student',
  academicBackground: 'Computer Science',
  researchInterests: ['Artificial Intelligence', 'Cybersecurity'],
  skills: ['Python', 'Machine Learning'],
  portraitUrl: '/images/demo-student-alex.jpg',
}

const DEMO_PROFESSOR = {
  name: 'Dr. Sarah Chen',
  initials: 'SC',
  role: 'Professor',
  researchArea: 'AI Security',
  university: 'Example University',
  openPosition: 'AI Security Research Assistant',
  portraitUrl: '/images/demo-professor-sarah.jpg',
}

// ── Research Areas Data ────────────────────────────────────────────────────────

const RESEARCH_AREAS = [
  {
    title: 'Artificial Intelligence',
    count: 'Explore labs',
    icon: Sparkles,
    bgClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title: 'Computer Vision',
    count: 'Explore labs',
    icon: Eye,
    bgClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Machine Learning',
    count: 'Explore labs',
    icon: Cpu,
    bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Robotics',
    count: 'Explore labs',
    icon: Bot,
    bgClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    title: 'Cybersecurity',
    count: 'Explore labs',
    icon: Shield,
    bgClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Natural Language Processing',
    count: 'Explore labs',
    icon: MessageSquare,
    bgClass: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    title: 'Data Science',
    count: 'Explore labs',
    icon: BarChart3,
    bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Human–Computer Interaction',
    count: 'Explore labs',
    icon: Users,
    bgClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
]

// ── 5-Step Path Data ──────────────────────────────────────────────────────────

const STEPS = [
  {
    step: '01',
    title: 'Build your academic profile',
    description: 'Add your research interests, technical skills, publications, and CV.',
  },
  {
    step: '02',
    title: 'Discover professors',
    description: 'Filter active labs by discipline, university, and funding availability.',
  },
  {
    step: '03',
    title: 'Understand your match',
    description: 'Review clear compatibility factors across topics, skills, and background.',
  },
  {
    step: '04',
    title: 'Apply to opportunities',
    description: 'Submit tailored research motivation statements to open positions.',
  },
  {
    step: '05',
    title: 'Connect & interview',
    description: 'Message faculty directly and track interview schedules in one workspace.',
  },
]

const PLATFORM_FEATURES = [
  {
    title: 'Explainable matching',
    description: 'See exactly how your interests, skills, and academic background align with each lab.',
    icon: Sparkles,
  },
  {
    title: 'Comprehensive lab profiles',
    description: 'Explore detailed faculty research areas, ongoing projects, and recent publications.',
    icon: ShieldCheck,
  },
  {
    title: 'Funded opportunities',
    description: "Find Master's and PhD positions with transparent funding types and availability.",
    icon: GraduationCap,
  },
  {
    title: 'Direct applications',
    description: 'Apply thoughtfully, share your CV, and coordinate interviews in one workspace.',
    icon: MessageSquare,
  },
]

function DemoPortrait({
  src,
  alt,
  initials,
  accentClass,
}: {
  src: string
  alt: string
  initials: string
  accentClass: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`w-11 h-11 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${accentClass}`}
        aria-label={alt}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-11 h-11 rounded-full object-cover object-top border border-slate-200/90 shadow-2xs shrink-0 bg-slate-100"
    />
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [heroQuery, setHeroQuery] = useState('')
  const [featuredProfessors, setFeaturedProfessors] = useState<ProfessorProfile[]>([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadFeatured() {
      try {
        const profs = await fetchPublicProfessorsSafely(3)
        if (cancelled) return
        const list: ProfessorProfile[] = profs.map((raw) => ({
          ...raw,
          uid: raw.uid,
          fullName: raw.fullName ?? 'Professor',
          username: raw.username ?? raw.uid,
          academicTitle: raw.academicTitle ?? 'Faculty',
          department: raw.department ?? '',
          university: raw.university ?? '',
          researchAreas: Array.isArray(raw.researchAreas) ? raw.researchAreas : [],
          isRecruiting: Boolean(raw.isRecruiting),
          recruitingStatus:
            raw.recruitingStatus || (raw.isRecruiting ? 'actively_recruiting' : 'not_recruiting'),
          fundingInfo: normalizeProfessorFundingInfo(raw.fundingInfo),
        }))
        setFeaturedProfessors(list)
      } catch (err) {
        console.error('Failed to load featured professors:', err)
        if (!cancelled) setFeaturedProfessors([])
      } finally {
        if (!cancelled) setLoadingFeatured(false)
      }
    }
    loadFeatured()
    return () => {
      cancelled = true
    }
  }, [])

  const handleHeroSearch = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = heroQuery.trim()
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    } else {
      navigate('/search')
    }
  }

  return (
    <div className="bg-white min-h-screen text-slate-900 overflow-x-hidden">
      {/* ── 1. Hero Section ───────────────────────────────────────────────── */}
      <section className="relative bg-white border-b border-slate-200/75">
        {/* Subtle light top wash preserving the pure white theme */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-50/45 via-slate-50/25 to-transparent"
        />

        <div className="relative pt-8 pb-12 sm:pt-10 sm:pb-14 lg:pt-12 lg:pb-16 px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-center">
            {/* Left Column: Headline, Quick Search & Role CTAs */}
            <div className="lg:col-span-7 space-y-5">
              {/* Main Headline */}
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] xl:text-[3.15rem] font-extrabold text-slate-900 tracking-[-0.025em] leading-[1.1]">
                Find the right professor.
                <br />
                <span className="text-blue-600">Find the right research opportunity.</span>
              </h1>

              {/* Supporting Description */}
              <p className="text-sm sm:text-base text-slate-600 max-w-xl xl:max-w-2xl leading-relaxed">
                Discover professors and funded Master's and PhD positions that match your academic
                goals, technical skills, and research experience.
              </p>

              {/* Quick Discovery Search Bar */}
              <form
                onSubmit={handleHeroSearch}
                className="max-w-xl xl:max-w-[38rem] bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-[0_6px_22px_-6px_rgba(15,23,42,0.07)] focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5"
              >
                <div className="flex items-center gap-2.5 flex-1 px-3 py-1.5 min-w-0">
                  <Search size={16} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={heroQuery}
                    onChange={(e) => setHeroQuery(e.target.value)}
                    placeholder="Search research areas, professors, or universities..."
                    aria-label="Search research areas, professors, or universities"
                    className="w-full min-w-0 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  variant="accent"
                  size="md"
                  className="rounded-xl px-5 shrink-0 font-semibold"
                >
                  <span>Explore Labs</span>
                  <ArrowRight size={15} />
                </Button>
              </form>

              {/* Secondary Role CTAs */}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/signup/student')}
                  className="rounded-xl shadow-2xs"
                >
                  <BookOpen size={15} />
                  <span>Join as Student</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate('/signup/professor')}
                  className="rounded-xl bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50"
                >
                  <GraduationCap size={16} />
                  <span>Join as Professor</span>
                </Button>
              </div>

              {/* Concise Value Pillars */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Explainable compatibility criteria
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Transparent funding status
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  Direct faculty applications
                </span>
              </div>
            </div>

            {/* Right Column: Illustrative Academic Matching Preview */}
            <div className="lg:col-span-5">
              <div
                aria-label="Illustrative example of how student and professor matching works"
                className="mx-auto max-w-md lg:max-w-none bg-white rounded-2xl p-5 border border-slate-200/90 shadow-[0_16px_40px_-14px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.02] space-y-3.5"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">
                    Academic Match Preview
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    Illustrative Example
                  </span>
                </div>

                {/* Example Student Profile Card */}
                <div className="rounded-xl bg-slate-50/80 border border-slate-200/75 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <DemoPortrait
                      src={DEMO_STUDENT.portraitUrl}
                      alt={`${DEMO_STUDENT.name}, illustrative student profile`}
                      initials={DEMO_STUDENT.initials}
                      accentClass="bg-slate-100 text-slate-700 border-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          {DEMO_STUDENT.name}
                        </h2>
                        <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md shrink-0">
                          {DEMO_STUDENT.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {DEMO_STUDENT.academicBackground}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {DEMO_STUDENT.researchInterests.map((interest) => (
                      <span
                        key={interest}
                        className="px-2 py-0.5 rounded-md bg-blue-50/90 border border-blue-100 text-blue-700 text-[11px] font-medium"
                      >
                        {interest}
                      </span>
                    ))}
                    {DEMO_STUDENT.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600 text-[11px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Matching Connection Bar */}
                <div className="flex items-center gap-2.5 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-semibold shrink-0">
                    <Link2 size={12} className="text-emerald-600" />
                    <span>High Compatibility</span>
                    <span className="inline-flex items-center gap-0.5 ml-1" aria-hidden="true">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" />
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Example Professor Profile Card */}
                <div className="rounded-xl bg-slate-50/80 border border-slate-200/75 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <DemoPortrait
                      src={DEMO_PROFESSOR.portraitUrl}
                      alt={`${DEMO_PROFESSOR.name}, illustrative professor profile`}
                      initials={DEMO_PROFESSOR.initials}
                      accentClass="bg-blue-50 text-blue-700 border-blue-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900 truncate">
                          {DEMO_PROFESSOR.name}
                        </h2>
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-md shrink-0">
                          {DEMO_PROFESSOR.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {DEMO_PROFESSOR.researchArea} · {DEMO_PROFESSOR.university}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200/80 px-2.5 py-1.5 text-xs text-slate-700">
                    <Briefcase size={13} className="text-blue-600 shrink-0" />
                    <span className="font-medium truncate">
                      Open role: <span className="font-semibold text-slate-900">{DEMO_PROFESSOR.openPosition}</span>
                    </span>
                  </div>
                </div>

                {/* Concise Matching Criteria Breakdown */}
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/70 px-3.5 py-2.5 space-y-1.5">
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <Check size={13} className="text-emerald-600 stroke-[2.75] mt-0.5 shrink-0" />
                    <span>
                      <strong className="font-semibold text-slate-900">Research interests:</strong>{' '}
                      AI & Cybersecurity align with AI Security
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <Check size={13} className="text-emerald-600 stroke-[2.75] mt-0.5 shrink-0" />
                    <span>
                      <strong className="font-semibold text-slate-900">Technical skills:</strong>{' '}
                      Python, Machine Learning & CS background
                    </span>
                  </div>
                </div>

                {/* Action to Explore Real Research Opportunities */}
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="w-full text-left group cursor-pointer bg-blue-50/75 hover:bg-blue-50 border border-blue-200/80 hover:border-blue-300 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                      Explore open research opportunities
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      Browse real faculty profiles and funded positions
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-white border border-blue-200/80 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shrink-0">
                    <ArrowRight
                      size={13}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Five-Step Process ("A CLEAR PATH FORWARD") ──────────────────── */}
      <section
        id="how-it-works"
        className="py-12 sm:py-16 bg-slate-50/70 border-b border-slate-200/80"
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="text-center max-w-2xl mx-auto mb-9 space-y-2">
            <span className="inline-block text-xs font-bold tracking-[0.14em] text-blue-600 uppercase">
              A CLEAR PATH FORWARD
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              From academic goals to the right research team
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Scholivo makes professor discovery focused, transparent, and personal.
            </p>
          </div>

          {/* 5-Column Cohesive Step Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {STEPS.map((item, index) => (
              <div
                key={item.step}
                className="h-full bg-white rounded-2xl border border-slate-200/85 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 font-display font-bold text-xs flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors duration-200">
                      {item.step}
                    </span>
                    {index < STEPS.length - 1 && (
                      <ChevronRight
                        size={15}
                        className="hidden lg:block text-slate-300 group-hover:text-blue-400 transition-colors"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-display text-sm font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Research Areas Grid ─────────────────────────────────────────── */}
      <section id="research-areas" className="py-12 sm:py-16 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
            <div className="space-y-1">
              <span className="text-xs font-bold tracking-[0.14em] text-blue-600 uppercase">
                EXPLORE DISCIPLINES
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Research Areas
              </h2>
              <p className="text-sm text-slate-600">
                Browse faculty and research groups by academic specialization.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 self-start sm:self-auto cursor-pointer group"
            >
              <span>View full directory</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* 2x4 Grid of Domain Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {RESEARCH_AREAS.map((area) => {
              const Icon = area.icon
              return (
                <button
                  key={area.title}
                  type="button"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(area.title)}`)}
                  className="text-left group cursor-pointer bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:border-blue-200 hover:shadow-[0_10px_24px_-8px_rgba(37,99,235,0.12)] hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${area.bgClass}`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug truncate">
                        {area.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{area.count}</p>
                    </div>
                  </div>

                  <ChevronRight
                    size={15}
                    className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Featured Professors Section ─────────────────────────────────── */}
      <section className="py-12 sm:py-16 bg-slate-50/70 border-y border-slate-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
            <div className="space-y-1">
              <span className="text-xs font-bold tracking-[0.14em] text-blue-600 uppercase">
                FACULTY DIRECTORY
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Featured professors
              </h2>
              <p className="text-sm text-slate-600">
                Explore active faculty profiles, research areas, and current funding availability.
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/search')}
              className="self-start sm:self-auto bg-white rounded-xl"
            >
              <span>Browse all professors</span>
              <ArrowRight size={14} />
            </Button>
          </div>

          {loadingFeatured ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 animate-pulse"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-2/3" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-xl" />
                </div>
              ))}
            </div>
          ) : featuredProfessors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-2.5 shadow-2xs">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center mx-auto text-slate-400">
                <GraduationCap size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-display">
                No featured professors yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Registered professors and their active research opportunities will appear here as
                they join Scholivo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {featuredProfessors.map((prof) => (
                <div
                  key={prof.uid}
                  onClick={() => navigate(`/professor/${prof.username || prof.uid}`)}
                  className="h-full bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-[0_12px_28px_-10px_rgba(15,23,42,0.09)] hover:border-blue-300/90 hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer group"
                >
                  {/* Professor Info Header */}
                  <div className="space-y-3.5">
                    <div className="flex items-start gap-3">
                      <Avatar src={prof.photoURL} name={prof.fullName} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {prof.fullName}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium truncate">
                          {prof.academicTitle}
                          {prof.department ? ` · ${prof.department}` : ''}
                        </p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                          {prof.university}
                        </p>
                      </div>
                    </div>

                    {/* Recruiting & Funding Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RecruitingBadge status={prof.recruitingStatus} />
                      {prof.fundingInfo?.fundingStatus && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getFundingStatusBadgeStyle(
                            prof.fundingInfo.fundingStatus
                          )}`}
                        >
                          <DollarSign size={11} />
                          <span>
                            {PROFESSOR_FUNDING_STATUS_LABELS[prof.fundingInfo.fundingStatus]}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Research Area Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {(prof.researchAreas || []).slice(0, 3).map((area) => (
                        <span
                          key={area}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Meta & Action */}
                  <div className="pt-3.5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium">
                      View lab profile & positions
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:text-blue-700">
                      <span>View Profile</span>
                      <ArrowRight
                        size={13}
                        className="group-hover:translate-x-0.5 transition-transform"
                      />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Light Feature Callout ("BUILT FOR RESEARCH") ─────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1440px] mx-auto bg-white">
        <div className="bg-gradient-to-br from-white via-blue-50/35 to-slate-50/90 rounded-3xl border border-slate-200/90 p-6 sm:p-9 lg:p-11 shadow-[0_16px_44px_-16px_rgba(15,23,42,0.06)] relative overflow-hidden">
          {/* Subtle light blue decorative wash */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
            {/* Left Column */}
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-block text-xs font-bold tracking-[0.14em] text-blue-600 uppercase">
                BUILT FOR RESEARCH
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                More than search.
                <br />
                <span className="text-blue-600">A smarter way to find your academic fit.</span>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed max-w-md">
                Every recommendation is grounded in the factors that actually matter for meaningful
                graduate research collaboration.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  variant="accent"
                  size="md"
                  onClick={() => navigate('/signup')}
                  className="rounded-xl font-semibold shadow-2xs"
                >
                  <span>Create your account</span>
                  <ArrowRight size={15} />
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate('/search')}
                  className="rounded-xl bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50"
                >
                  <span>Browse directory</span>
                </Button>
              </div>
            </div>

            {/* Right Column: 2x2 Crisp White Feature Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PLATFORM_FEATURES.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.title}
                    className="h-full bg-white rounded-2xl border border-slate-200/85 p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all duration-200 space-y-2.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                      <Icon size={18} />
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
