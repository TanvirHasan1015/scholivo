import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/common/BrandLogo'

export function Footer() {
  return (
    <footer className="bg-[#0b132b] text-slate-300 border-t border-slate-800">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo variant="dark" textSize="lg" showTagline />
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Helping students and professors find the right research collaboration through transparent requirements, explainable matching, and direct applications.
            </p>
          </div>

          {/* Links: Platform */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/search"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Find Professors
                </Link>
              </li>
              <li>
                <a
                  href="/#research-areas"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Research Areas
                </a>
              </li>
              <li>
                <a
                  href="/#how-it-works"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  How it works
                </a>
              </li>
            </ul>
          </div>

          {/* Links: For Members */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
              For Members
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/signup/student"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  For Students
                </Link>
              </li>
              <li>
                <Link
                  to="/signup/professor"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  For Professors
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Log in
                </Link>
              </li>
            </ul>
          </div>

          {/* Links: Get Started */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">
              Get Started
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/signup"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Join Scholivo
                </Link>
              </li>
              <li>
                <Link
                  to="/search"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Explore Faculty Directory
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Member Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Scholivo. Academic Opportunities, Connected.</p>
          <div className="flex items-center gap-4 text-slate-500">
            <span>Academic Research Network</span>
            <span>·</span>
            <span>Explainable Faculty Matching</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
