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
import { auth, db } from '@/lib/firebase'
import type { UserRole } from '@/types/user.types'

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<UserRole | null>
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true)
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

  const signIn = async (email: string, password: string): Promise<UserRole | null> => {
    setLoading(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const userRole = await fetchRole(credential.user.uid)
      setUser(credential.user)
      setRole(userRole)
      return userRole
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    userRole: UserRole
  ): Promise<User> => {
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
    await signOut(auth)
    setUser(null)
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
