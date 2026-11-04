import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'
import { Search, Bell, Menu, X, ChevronDown, User, Bookmark, LayoutDashboard, LogOut } from 'lucide-react'

export function Navbar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const dashboardPath =
    role === 'professor'
      ? '/dashboard/professor'
      : '/dashboard/student'

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <BrandLogo />

        {/* Center: Primary Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/search"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Find Professors
          </Link>
          <a
            href={location.pathname === '/' ? '#research-areas' : '/#research-areas'}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Research Areas
          </a>
          <a
            href={location.pathname === '/' ? '#how-it-works' : '/#how-it-works'}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            How it works
          </a>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Search Shortcut */}
          <button
            onClick={() => navigate('/search')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Search"
            title="Search professors"
          >
            <Search size={18} />
          </button>

          {user ? (
            <>
              {/* Notifications */}
              <button
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
              </button>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  id="profile-menu-btn"
                >
                  <Avatar src={user.photoURL} name={user.displayName || 'User'} size="sm" />
                  <span className="hidden sm:block text-xs font-semibold text-slate-700 max-w-[100px] truncate">
                    {user.displayName?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 fade-in-up">
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {user.displayName || 'Signed In'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {role && (
                        <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {role}
                        </span>
                      )}
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <Link
                        to={dashboardPath}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <LayoutDashboard size={14} className="text-slate-500" />
                        Dashboard
                      </Link>

                      <Link
                        to={role === 'professor' ? '/profile/professor/edit' : '/profile/student'}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <User size={14} className="text-slate-500" />
                        My Profile
                      </Link>

                      {role === 'student' && (
                        <Link
                          to="/saved"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
                        >
                          <Bookmark size={14} className="text-slate-500" />
                          Saved Professors
                        </Link>
                      )}

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={() => {
                          setProfileOpen(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="font-medium text-slate-700 hover:text-slate-900"
              >
                Log in
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/signup/student')}
                className="shadow-xs font-medium"
              >
                Join Scholivo
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2 shadow-lg fade-in-up">
          <Link
            to="/search"
            className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Find Professors
          </Link>
          <a
            href={location.pathname === '/' ? '#research-areas' : '/#research-areas'}
            className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Research Areas
          </a>
          <a
            href={location.pathname === '/' ? '#how-it-works' : '/#how-it-works'}
            className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            How it works
          </a>

          {!user && (
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Button
                variant="secondary"
                fullWidth
                size="md"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/login')
                }}
              >
                Log in
              </Button>
              <Button
                variant="primary"
                fullWidth
                size="md"
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/signup/student')
                }}
              >
                Join Scholivo
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
