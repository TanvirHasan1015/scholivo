import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { PROFILE_PHOTO_UPDATED_EVENT } from '@/lib/profilePhoto'
import { subscribeToUnreadMessageCount } from '@/lib/messaging'
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notifications'
import type { AppNotification } from '@/types/notification.types'
import { formatRelativeDate } from '@/utils/helpers'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { BrandLogo } from '@/components/common/BrandLogo'
import {
  Search,
  Menu,
  X,
  ChevronDown,
  User,
  Bookmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Bell,
  CheckCheck,
  Calendar,
  FileText,
} from 'lucide-react'

export function Navbar() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [livePhotoURL, setLivePhotoURL] = useState<string | undefined>(undefined)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Keep Navbar avatar synced with Firestore profile photoURL and instant upload/remove events
  useEffect(() => {
    if (!user?.uid) {
      setLivePhotoURL(undefined)
      return
    }
    let isMounted = true
    setLivePhotoURL(user.photoURL || undefined)

    const colName = role === 'professor' ? 'professors' : role === 'student' ? 'students' : 'users'
    getDoc(doc(db, colName, user.uid))
      .then((snap) => {
        if (!isMounted || !snap.exists()) return
        const data = snap.data() as { photoURL?: string }
        if (typeof data.photoURL === 'string') {
          setLivePhotoURL(data.photoURL)
        }
      })
      .catch(() => {
        // Fallback to user.photoURL
      })

    const handlePhotoEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ uid: string; photoURL: string }>).detail
      if (detail && detail.uid === user.uid) {
        setLivePhotoURL(detail.photoURL)
      }
    }
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, handlePhotoEvent)
    return () => {
      isMounted = false
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, handlePhotoEvent)
    }
  }, [user?.uid, user?.photoURL, role])

  // Real-time unread message count for the signed-in user
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeToUnreadMessageCount(user.uid, (count) => {
      setUnreadCount(count)
    })
    return () => unsubscribe()
  }, [user?.uid])

  // Real-time persistent notifications for the signed-in user
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeToUserNotifications(user.uid, (list) => {
      setNotifications(list)
    })
    return () => unsubscribe()
  }, [user?.uid])

  const effectiveUnreadCount = user ? unreadCount : 0
  const unreadBadgeText = effectiveUnreadCount > 99 ? '99+' : String(effectiveUnreadCount)

  const effectiveNotifications = user ? notifications : []
  const unreadNotifIds = effectiveNotifications.filter((n) => !n.isRead).map((n) => n.id)
  const unreadNotifCount = unreadNotifIds.length
  const unreadNotifBadgeText = unreadNotifCount > 99 ? '99+' : String(unreadNotifCount)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu and dropdowns on route change
  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const dashboardPath =
    role === 'professor'
      ? '/dashboard/professor'
      : '/dashboard/student'

  const logoTarget =
    user && (role === 'professor' || role === 'student') ? dashboardPath : '/'

  const handleNotificationClick = async (notif: AppNotification) => {
    setNotifOpen(false)
    if (user?.uid && !notif.isRead) {
      markNotificationAsRead(user.uid, notif.id).catch((err) => {
        console.error('Failed to mark notification as read:', err)
      })
    }
    if (notif.applicationId) {
      navigate(`/applications/${notif.applicationId}`)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user?.uid || unreadNotifIds.length === 0) return
    try {
      await markAllNotificationsAsRead(user.uid, unreadNotifIds)
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <nav className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <BrandLogo to={logoTarget} />

        {/* Center: Primary Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center gap-7">
          {user && role === 'student' ? (
            <>
              <Link
                to="/dashboard/student"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/dashboard/student'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/search"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/search'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Find Professors
              </Link>
              <Link
                to="/applications"
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/applications')
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Applications
              </Link>
              <Link
                to="/saved"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/saved'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Saved Faculty
              </Link>
            </>
          ) : user && role === 'professor' ? (
            <>
              <Link
                to="/dashboard/professor"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/dashboard/professor'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/positions/manage"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/positions/manage'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manage Positions
              </Link>
              <Link
                to="/profile/professor/edit"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/profile/professor/edit'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Faculty Profile
              </Link>
              <Link
                to="/search"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/search'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Directory
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/search"
                className={`text-sm font-medium transition-colors ${
                  location.pathname === '/search'
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
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
            </>
          )}
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
              {/* Messages shortcut */}
              <button
                onClick={() => navigate('/messages')}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
                aria-label={effectiveUnreadCount > 0 ? `Messages (${unreadBadgeText} unread)` : 'Messages'}
                title="Messages"
                id="navbar-messages-btn"
              >
                <MessageSquare size={18} />
                {effectiveUnreadCount > 0 && (
                  <span
                    id="navbar-unread-badge"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white shadow-xs"
                  >
                    {unreadBadgeText}
                  </span>
                )}
              </button>

              {/* Notification Center */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => {
                    setNotifOpen(!notifOpen)
                    setProfileOpen(false)
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
                  aria-label={unreadNotifCount > 0 ? `Notifications (${unreadNotifBadgeText} unread)` : 'Notifications'}
                  title="Notifications"
                  id="navbar-notifications-btn"
                >
                  <Bell size={18} />
                  {unreadNotifCount > 0 && (
                    <span
                      id="navbar-notifications-badge"
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white shadow-xs"
                    >
                      {unreadNotifBadgeText}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-12 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 fade-in-up"
                    id="navbar-notifications-panel"
                  >
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Notifications</span>
                        {unreadNotifCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                            {unreadNotifCount} unread
                          </span>
                        )}
                      </div>
                      {unreadNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                          id="mark-all-notifications-read-btn"
                        >
                          <CheckCheck size={13} />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {effectiveNotifications.length === 0 ? (
                        <div className="py-10 px-4 text-center space-y-1.5">
                          <Bell size={22} className="mx-auto text-slate-300" />
                          <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                          <p className="text-[11px] text-slate-400">
                            Application updates and interview schedules will appear here.
                          </p>
                        </div>
                      ) : (
                        effectiveNotifications.map((notif) => {
                          const isInterview =
                            notif.type === 'interview_scheduled' || notif.type === 'interview_rescheduled'
                          return (
                            <button
                              key={notif.id}
                              type="button"
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                                notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                              }`}
                              id={`notification-item-${notif.id}`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                  isInterview
                                    ? 'bg-purple-50 text-purple-600 border border-purple-100'
                                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                                }`}
                              >
                                {isInterview ? <Calendar size={14} /> : <FileText size={14} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    className={`text-xs leading-snug ${
                                      notif.isRead ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                                    }`}
                                  >
                                    {notif.title}
                                  </p>
                                  {!notif.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 mt-1" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                  {notif.description}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {formatRelativeDate(notif.createdAt)}
                                </p>
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  id="profile-menu-btn"
                >
                  <Avatar src={livePhotoURL ?? user.photoURL} name={user.displayName || 'User'} size="sm" />
                  <span className="hidden sm:block text-xs font-semibold text-slate-700 max-w-[100px] truncate">
                    {user.displayName?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 fade-in-up">
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                      <Avatar src={livePhotoURL ?? user.photoURL} name={user.displayName || 'User'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {user.displayName || 'Signed In'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        {role && (
                          <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {role}
                          </span>
                        )}
                      </div>
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

                      <Link
                        to="/messages"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <MessageSquare size={14} className="text-slate-500" />
                          Messages
                        </span>
                        {effectiveUnreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                            {unreadBadgeText}
                          </span>
                        )}
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
                onClick={() => navigate('/signup')}
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
        <div className="md:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-1.5 shadow-lg fade-in-up">
          {user ? (
            <>
              <Link
                to={dashboardPath}
                className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/search"
                className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {role === 'professor' ? 'Faculty Directory' : 'Find Professors'}
              </Link>
              {role === 'student' ? (
                <>
                  <Link
                    to="/applications"
                    className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Applications
                  </Link>
                  <Link
                    to="/saved"
                    className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Saved Professors
                  </Link>
                  <Link
                    to="/profile/student"
                    className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Academic Profile
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/positions/manage"
                    className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Manage Positions
                  </Link>
                  <Link
                    to="/profile/professor/edit"
                    className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Faculty Profile & Settings
                  </Link>
                </>
              )}
              <Link
                to="/messages"
                className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <span>Messages</span>
                {effectiveUnreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                    {unreadBadgeText}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <>
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
                    navigate('/signup')
                  }}
                >
                  Join Scholivo
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )
}
