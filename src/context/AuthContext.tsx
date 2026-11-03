import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, db, isDemoMode } from '@/lib/firebase'
import type { UserRole } from '@/types/user.types'

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const isValidRole = (value: unknown): value is UserRole =>
    value === 'student' || value === 'professor'

  const fetchRole = async (uid: string): Promise<UserRole | null> => {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        const fetchedRole = snap.data().role
        return isValidRole(fetchedRole) ? fetchedRole : null
      }
    } catch (e) {
      console.error('Failed to fetch role:', e)
    }
    return null
  }

  useEffect(() => {
    if (isDemoMode) {
      // In demo mode, load demo student session
      const isLoggedOut = localStorage.getItem('rm_logged_out') === 'true'
      const saved = localStorage.getItem('rm_demo_user')

      if (saved && !isLoggedOut) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed?.user && isValidRole(parsed?.role)) {
            setUser(parsed.user)
            setRole(parsed.role)
          } else {
            localStorage.removeItem('rm_demo_user')
            setUser(null)
            setRole(null)
          }
        } catch {
          localStorage.removeItem('rm_demo_user')
          setUser(null)
          setRole(null)
        }
      } else if (!isLoggedOut) {
        // First-time visit in demo mode defaults to student session for frictionless preview
        const defaultStudent = {
          uid: 'demo-student',
          email: 'alex.rivera@university.edu',
          displayName: 'Alex Rivera',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          emailVerified: true,
        } as unknown as User
        setUser(defaultStudent)
        setRole('student')
        localStorage.setItem('rm_demo_user', JSON.stringify({ user: defaultStudent, role: 'student' }))
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const userRole = await fetchRole(firebaseUser.uid)
        setRole(userRole)
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      localStorage.removeItem('rm_logged_out')
      const lower = email.toLowerCase().trim()

      // Check if user already exists in registered demo system users
      let matchedSysUser: any = null
      const systemUsersStr = localStorage.getItem('rm_demo_system_users')
      if (systemUsersStr) {
        try {
          const sysUsers = JSON.parse(systemUsersStr)
          matchedSysUser = sysUsers.find((u: any) => u.email && u.email.toLowerCase() === lower)
        } catch {
          // ignore
        }
      }

      const assignedRole: UserRole = isValidRole(matchedSysUser?.role)
        ? matchedSysUser.role
        : (lower.includes('prof') || lower.includes('faculty') || lower.includes('kim'))
        ? 'professor'
        : 'student'

      const demoUser = {
        uid: matchedSysUser?.uid || (assignedRole === 'professor' ? 'demo-1' : 'demo-student'),
        email: matchedSysUser?.email || email || (assignedRole === 'professor' ? 'minji.kim@kaist.ac.kr' : 'alex.rivera@university.edu'),
        displayName: matchedSysUser?.displayName || (assignedRole === 'professor' ? 'Prof. Minji Kim' : 'Alex Rivera'),
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        emailVerified: true,
      } as unknown as User

      setUser(demoUser)
      setRole(assignedRole)
      localStorage.setItem('rm_demo_user', JSON.stringify({ user: demoUser, role: assignedRole }))
      return
    }
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    userRole: UserRole
  ): Promise<User> => {
    if (isDemoMode) {
      localStorage.removeItem('rm_logged_out')
      const demoUser = {
        uid: `demo-${Date.now()}`,
        email,
        displayName,
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        emailVerified: true,
      } as unknown as User
      setUser(demoUser)
      setRole(userRole)
      localStorage.setItem('rm_demo_user', JSON.stringify({ user: demoUser, role: userRole }))
      return demoUser
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const { user: newUser } = credential

    await updateProfile(newUser, { displayName })
    await sendEmailVerification(newUser)

    // Create base user document
    await setDoc(doc(db, 'users', newUser.uid), {
      uid: newUser.uid,
      email: newUser.email,
      displayName,
      role: userRole,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setRole(userRole)
    return newUser
  }

  const logout = async () => {
    if (isDemoMode) {
      localStorage.removeItem('rm_demo_user')
      localStorage.setItem('rm_logged_out', 'true')
      setUser(null)
      setRole(null)
      return
    }
    await signOut(auth)
    setRole(null)
  }

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
