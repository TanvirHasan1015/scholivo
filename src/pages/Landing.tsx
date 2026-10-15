import { Link, useNavigate } from 'react-router-dom'
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
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/common/Button'
import { VerificationBadge } from '@/components/common/Badges'

// ── Research Areas Data ────────────────────────────────────────────────────────

const RESEARCH_AREAS = [
  {
    title: 'Artificial Intelligence',
    count: '32 professors',
    icon: Sparkles,
    bgClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title: 'Computer Vision',
    count: '39 professors',
    icon: Eye,
    bgClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Machine Learning',
    count: '46 professors',
    icon: Cpu,
    bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Robotics',
    count: '53 professors',
    icon: Bot,
    bgClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    title: 'Cybersecurity',
    count: '60 professors',
    icon: Shield,
    bgClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Natural Language Processing',
    count: '67 professors',
    icon: MessageSquare,
    bgClass: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    title: 'Data Science',
    count: '74 professors',
    icon: BarChart3,
    bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    title: 'Human–Computer Interaction',
    count: '81 professors',
    icon: Users,
    bgClass: 'bg-amber-50 text-amber-600 border-amber-100',
  },
]

// ── 5-Step Path Data ──────────────────────────────────────────────────────────

const STEPS = [
  { step: '1', title: 'Build your academic profile' },
  { step: '2', title: 'Discover professors' },
  { step: '3', title: 'Understand your match' },
  { step: '4', title: 'Apply to opportunities' },
  { step: '5', title: 'Connect & interview' },
]

// ── Featured Professors Data ──────────────────────────────────────────────────

const FEATURED_PROFESSORS = [
  {
    name: 'Prof. Minji Kim',
    username: 'profkim',
    academicTitle: 'Associate Professor',
    department: 'School of Computing',
    university: 'KAIST',
    avatarUrl:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
    researchAreas: ['Medical AI', 'Computer Vision', 'Deep Learning'],
    matchScore: 94,
    recruiting: true,
    funded: true,
  },
  {
    name: 'Prof. Daniel Lee',
    username: 'proflee',
    academicTitle: 'Professor',
    department: 'Computer Science & Engineering',
    university: 'Seoul National University',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300',
    researchAreas: ['Robotics', 'Control Systems', 'Autonomous Vehicles'],
    matchScore: 91,
    recruiting: true,
    funded: true,
  },
  {
    name: 'Prof. Emily Chen',
    username: 'profchen',
    academicTitle: 'Assistant Professor',
    department: 'CSAIL',
    university: 'MIT',
    avatarUrl:
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300',
    researchAreas: ['NLP', 'Language Models', 'AI Safety'],
    matchScore: 89,
    recruiting: true,
    funded: true,
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900">
      {/* ── 1. Hero Section ───────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline & Action Triggers */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
              <Sparkles size={13} className="text-blue-600" />
              <span>Research discovery, reimagined</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              Find the right professor.
              <br />
              <span className="text-blue-600">Find the right research opportunity.</span>
            </h1>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Discover verified professors and funded Master's and PhD positions that match your
              academic goals, skills, and experience.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/search')}
                className="shadow-sm"
              >
                <span>Find Professors</span>
                <Search size={16} />
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/signup/student')}
                className="bg-white border-slate-200 hover:bg-slate-50"
              >
                Join Scholivo
              </Button>
            </div>

            {/* Social Proof Avatars */}
            <div className="pt-6 flex items-center gap-3.5">
              <div className="flex -space-x-2.5 overflow-hidden">
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120"
                  alt="Professor"
                />
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120"
                  alt="Professor"
                />
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120"
                  alt="Professor"
                />
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120"
                  alt="Professor"
                />
              </div>
              <p className="text-xs font-medium text-slate-500">
                <strong className="font-semibold text-slate-800">2,400+</strong> verified
                professors across leading universities
              </p>
            </div>
          </div>

          {/* Right Column: Match Maker Widget ("HOW YOUR MATCH IS MADE") */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md lg:max-w-none bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl space-y-5">
              {/* Widget Header */}
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                HOW YOUR MATCH IS MADE
              </div>

              {/* Connected Profiles Card */}
              <div className="flex items-center justify-between gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
                {/* Student Profile */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-300/60">
                    TH
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Your profile</h4>
                    <p className="text-[11px] text-slate-500">AI · Computer Vision</p>
                  </div>
                </div>

                {/* Match Score Indicator Pill */}
                <div className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold shadow-xs shrink-0">
                  94%
                </div>

                {/* Professor Profile */}
                <div className="flex items-center gap-3 text-right justify-end">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">Prof. Minji Kim</h4>
                    <p className="text-[11px] text-slate-500">Medical AI · KAIST</p>
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=160"
                    alt="Prof. Minji Kim"
                    className="w-11 h-11 rounded-full object-cover shrink-0 border border-slate-200"
                  />
                </div>
              </div>

              {/* Match Factors Badges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800 font-medium">
                    <Check size={11} className="text-emerald-700 stroke-[3]" />
                    <span>Research fit</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-900 mt-0.5">96%</div>
                </div>

                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800 font-medium">
                    <Check size={11} className="text-emerald-700 stroke-[3]" />
                    <span>Skills fit</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-900 mt-0.5">92%</div>
                </div>

                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800 font-medium">
                    <Check size={11} className="text-emerald-700 stroke-[3]" />
                    <span>Academic fit</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-900 mt-0.5">95%</div>
                </div>
              </div>

              {/* Embedded Recommended Opportunity Card */}
              <div
                onClick={() => navigate('/professor/profkim')}
                className="group cursor-pointer bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between gap-3 hover:bg-slate-800 transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      RECOMMENDED OPPORTUNITY
                    </span>
                    <h5 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                      PhD in Medical AI
                    </h5>
                    <p className="text-[11px] text-slate-400">Fully funded · Fall 2026</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Five-Step Process ("A CLEAR PATH FORWARD") ──────────────────── */}
      <section id="how-it-works" className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              A CLEAR PATH FORWARD
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              From academic goals to the right research team
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              Scholivo makes professor discovery focused, transparent, and personal.
            </p>
          </div>

          {/* Steps Grid with Connectors */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {STEPS.map((item, index) => (
              <div key={item.step} className="flex items-center gap-6 w-full lg:w-auto">
                <div className="flex flex-col items-center text-center p-2 flex-1 group">
                  {/* Step Circle */}
                  <div className="mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 border border-blue-200/90 font-bold text-xs flex items-center justify-center shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                      {item.step}
                    </div>
                  </div>

                  {/* Step Title */}
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug max-w-[140px]">
                    {item.title}
                  </h3>
                </div>

                {/* Chevron connector between steps */}
                {index < STEPS.length - 1 && (
                  <div className="hidden lg:flex items-center text-slate-300 select-none pb-6">
                    <ChevronRight size={18} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Research Areas Grid ─────────────────────────────────────────── */}
      <section id="research-areas" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:text-left">
          <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">
            EXPLORE DISCIPLINES
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Research Areas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Browse verified faculty by academic specialization.
          </p>
        </div>

        {/* 2x4 Grid of Domain Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESEARCH_AREAS.map((area) => {
            const Icon = area.icon
            return (
              <div
                key={area.title}
                onClick={() => navigate(`/search?q=${encodeURIComponent(area.title)}`)}
                className="group cursor-pointer bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${area.bgClass}`}
                  >
                    <Icon size={19} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                      {area.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{area.count}</p>
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0"
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 4. Featured Professors Section ("HIGHLY MATCHED") ──────────────── */}
      <section className="py-20 bg-slate-50 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold tracking-widest text-blue-600 uppercase">
                HIGHLY MATCHED
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                Featured professors
              </h2>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/search')}
              className="self-start sm:self-auto bg-white"
            >
              Browse all professors
            </Button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURED_PROFESSORS.map((prof) => (
              <div
                key={prof.username}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200 p-6 flex flex-col justify-between"
              >
                {/* Professor Info Header */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={prof.avatarUrl}
                      alt={prof.name}
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 shrink-0 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display text-base font-bold text-slate-900 truncate">
                          {prof.name}
                        </h3>
                      </div>
                      <div className="mt-1">
                        <VerificationBadge status="verified" size="sm" />
                      </div>
                      <p className="text-xs text-slate-600 mt-2 font-medium">
                        {prof.academicTitle} · {prof.department}
                      </p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{prof.university}</p>
                    </div>
                  </div>

                  {/* Research Area Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {prof.researchAreas.map((area) => (
                      <span key={area} className="tag text-xs">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Meta & Action */}
                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Recruiting
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Fully funded
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs font-bold text-emerald-700">
                      {prof.matchScore}% Match
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/professor/${prof.username}`)}
                      className="text-xs py-1.5 px-3"
                    >
                      <span>View</span>
                      <ArrowRight size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Dark Feature Callout ("BUILT FOR RESEARCH") ─────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-[#0b132b] text-white rounded-3xl p-8 sm:p-12 lg:p-16 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            {/* Left Column */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">
                BUILT FOR RESEARCH
              </span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                More than search.
                <br />
                A smarter way to find your academic fit.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                Every recommendation is based on the factors that actually matter for successful
                research collaboration.
              </p>
              <div>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => navigate('/signup/student')}
                  className="font-semibold"
                >
                  <span>Create your profile</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>

            {/* Right Column: 2x2 Feature Matrix */}
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Feature 1 */}
              <div className="space-y-3 p-2">
                <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Sparkles size={20} />
                </div>
                <h4 className="text-base font-bold text-white">Explainable matching</h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  See exactly how your interests, skills, and academic background align.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="space-y-3 p-2">
                <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ShieldCheck size={20} />
                </div>
                <h4 className="text-base font-bold text-white">Verified professors</h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Build trust through institutional email and identity verification.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="space-y-3 p-2">
                <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <GraduationCap size={20} />
                </div>
                <h4 className="text-base font-bold text-white">Funded opportunities</h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Find Master's and PhD positions with transparent funding details.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="space-y-3 p-2">
                <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <MessageSquare size={20} />
                </div>
                <h4 className="text-base font-bold text-white">Direct applications</h4>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Apply thoughtfully and connect in one professional workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
