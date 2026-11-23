import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { auth, db } from '@/lib/firebase'
import {
  buildDirectoryEntryFromProfessor,
  buildDirectoryEntryFromStudent,
  loadSplitStudentProfile,
  stripLegacyProfessorEmailIfPresent,
  syncUserDirectoryEntry,
} from '@/lib/messaging'
import type { ProfessorProfile, UserRole } from '@/types/user.types'

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  sessionError: string | null
  retrySession: () => Promise<void>
  signIn: (email: string, password: string) => Promise<UserRole | null>
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
    onProfileSetup?: (user: User) => Promise<void>
  ) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

function isTransientFirestoreError(err: unknown): boolean {
  const code = ((err as { code?: string })?.code || '').toLowerCase()
  const msg = ((err as { message?: string })?.message || '').toLowerCase()
  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network-request-failed') ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('failed to get document because the client is offline')
  )
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const activeAuthTransitionRef = useRef(false)

  const isValidRole = (value: unknown): value is UserRole =>
    value === 'student' || value === 'professor'

  const fetchRole = async (uid: string): Promise<UserRole | null> => {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      const fetchedRole = snap.data().role
      if (isValidRole(fetchedRole)) {
        if (fetchedRole === 'professor') {
          const pSnap = await getDoc(doc(db, 'professors', uid))
          if (!pSnap.exists()) {
            console.warn('Incomplete professor profile for UID:', uid)
            return null
          }
          const raw = pSnap.data() as Record<string, unknown>
          stripLegacyProfessorEmailIfPresent(uid, raw)
          syncUserDirectoryEntry(
            buildDirectoryEntryFromProfessor({
              ...(raw as Partial<ProfessorProfile>),
              uid,
            })
          ).catch(() => {})
        } else if (fetchedRole === 'student') {
          const res = await loadSplitStudentProfile(uid)
          if (!res.exists) {
            console.warn('Incomplete student profile for UID:', uid)
            return null
          }
          syncUserDirectoryEntry(
            buildDirectoryEntryFromStudent({
              ...res.data,
              uid,
            })
          ).catch(() => {})
        }
        return fetchedRole
      }
      console.error('Invalid or missing role in users/{uid} for UID:', uid)
      return null
    }

    // Legacy account check: inspect BOTH students/{uid} and professors/{uid} before backfilling
    const [studentRes, profRes] = await Promise.allSettled([
      getDoc(doc(db, 'students', uid)),
      getDoc(doc(db, 'professors', uid)),
    ])

    if (
      (studentRes.status === 'rejected' && isTransientFirestoreError(studentRes.reason)) ||
      (profRes.status === 'rejected' && isTransientFirestoreError(profRes.reason))
    ) {
      throw studentRes.status === 'rejected' ? studentRes.reason : (profRes as PromiseRejectedResult).reason
    }

    const studentSnap = studentRes.status === 'fulfilled' ? studentRes.value : null
    const profSnap = profRes.status === 'fulfilled' ? profRes.value : null

    const hasStudent = Boolean(studentSnap?.exists())
    const hasProf = Boolean(profSnap?.exists())

    // Ambiguous state (both exist) or uninitialized state (neither exists): do not auto-assign a role
    if ((hasStudent && hasProf) || (!hasStudent && !hasProf)) {
      if (hasStudent && hasProf) {
        console.error(
          'Ambiguous account state: both student and professor profiles exist for UID:',
          uid
        )
      }
      return null
    }

    if (hasStudent && !hasProf && studentSnap) {
      const sData = studentSnap.data() as { fullName?: string }
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: auth.currentUser?.email || null,
        displayName: sData.fullName || auth.currentUser?.displayName || 'Student Researcher',
        role: 'student',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {})
      loadSplitStudentProfile(uid)
        .then((res) => {
          if (res.exists) {
            syncUserDirectoryEntry(
              buildDirectoryEntryFromStudent({
                ...res.data,
                uid,
              })
            ).catch(() => {})
          }
        })
        .catch(() => {})
      return 'student'
    }

    if (hasProf && !hasStudent && profSnap) {
      const pData = profSnap.data() as Record<string, unknown>
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: auth.currentUser?.email || null,
        displayName:
          (typeof pData.fullName === 'string' && pData.fullName) ||
          auth.currentUser?.displayName ||
          'Faculty Member',
        role: 'professor',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {})
      stripLegacyProfessorEmailIfPresent(uid, pData)
      syncUserDirectoryEntry(
        buildDirectoryEntryFromProfessor({
          ...(pData as Partial<ProfessorProfile>),
          uid,
        })
      ).catch(() => {})
      return 'professor'
    }

    return null
  }

  const resolveAuthenticatedSession = async (firebaseUser: User) => {
    setSessionError(null)
    try {
      const userRole = await fetchRole(firebaseUser.uid)
      if (!userRole) {
        console.warn('Failed role/profile resolution for UID:', firebaseUser.uid)
        await signOut(auth).catch(() => {})
        setUser(null)
        setRole(null)
        setSessionError('Your account profile setup is incomplete. Please complete registration on the sign-up page.')
      } else {
        setUser(firebaseUser)
        setRole(userRole)
        setSessionError(null)
      }
    } catch (err) {
      console.error('Temporary error resolving session:', err)
      if (isTransientFirestoreError(err)) {
        // Preserve authenticated Firebase Auth session during temporary Firestore/network outage
        setUser(firebaseUser)
        setRole(null)
        setSessionError('Unable to verify your account due to a temporary connection issue. Please retry.')
      } else {
        await signOut(auth).catch(() => {})
        setUser(null)
        setRole(null)
        setSessionError('Failed to verify your account permissions. Please sign in again.')
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If signIn() or signUp() is actively resolving the user and role, let it finish
      // so onAuthStateChanged does not race and overwrite role or flicker loading state.
      if (activeAuthTransitionRef.current) {
        return
      }
      setLoading(true)
      if (firebaseUser) {
        await resolveAuthenticatedSession(firebaseUser)
      } else {
        setUser(null)
        setRole(null)
        setSessionError(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const retrySession = async () => {
    if (!auth.currentUser) return
    setLoading(true)
    try {
      await resolveAuthenticatedSession(auth.currentUser)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string): Promise<UserRole | null> => {
    activeAuthTransitionRef.current = true
    setLoading(true)
    setSessionError(null)
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const userRole = await fetchRole(credential.user.uid)
      if (!userRole) {
        await signOut(auth).catch(() => {})
        setUser(null)
        setRole(null)
        return null
      }
      setUser(credential.user)
      setRole(userRole)
      return userRole
    } finally {
      activeAuthTransitionRef.current = false
      setLoading(false)
    }
  }

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    userRole: UserRole,
    onProfileSetup?: (user: User) => Promise<void>
  ): Promise<User> => {
    activeAuthTransitionRef.current = true
    setLoading(true)
    setSessionError(null)
    let newUser: User

    try {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        newUser = credential.user
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code
        // If a previous signup attempt created the Auth account but failed before finishing
        // Firestore profile creation, allow the user to resume and complete registration.
        if (code === 'auth/email-already-in-use') {
          const previousUser = auth.currentUser
          const reusingExistingSession =
            Boolean(previousUser) &&
            previousUser?.email?.toLowerCase() === email.trim().toLowerCase()
          let signedInForRecovery = false

          try {
            const candidateUser = reusingExistingSession && previousUser
              ? previousUser
              : (await signInWithEmailAndPassword(auth, email.trim(), password)).user

            if (!reusingExistingSession) {
              signedInForRecovery = true
            }

            const [userDocRes, studentDocRes, profDocRes] = await Promise.allSettled([
              getDoc(doc(db, 'users', candidateUser.uid)),
              getDoc(doc(db, 'students', candidateUser.uid)),
              getDoc(doc(db, 'professors', candidateUser.uid)),
            ])

            const userDocSnap = userDocRes.status === 'fulfilled' ? userDocRes.value : null
            const hasStudentDoc =
              studentDocRes.status === 'fulfilled' && studentDocRes.value.exists()
            const hasProfDoc = profDocRes.status === 'fulfilled' && profDocRes.value.exists()
            const recordedRole = userDocSnap?.exists() ? userDocSnap.data().role : null

            // Block if account has conflicting profiles, belongs to the opposite role, or is already complete
            if (
              (hasStudentDoc && hasProfDoc) ||
              (recordedRole && recordedRole !== userRole) ||
              (userRole === 'student' && hasProfDoc) ||
              (userRole === 'professor' && hasStudentDoc) ||
              (userRole === 'student' && hasStudentDoc && recordedRole === 'student') ||
              (userRole === 'professor' && hasProfDoc && recordedRole === 'professor')
            ) {
              if (signedInForRecovery) {
                await signOut(auth).catch(() => {})
              }
              throw err
            }

            newUser = candidateUser
          } catch (recoveryErr) {
            if (signedInForRecovery && auth.currentUser?.email?.toLowerCase() === email.trim().toLowerCase()) {
              await signOut(auth).catch(() => {})
            }
            if (recoveryErr === err) throw err
            throw err
          }
        } else {
          throw err
        }
      }

      try {
        await updateProfile(newUser, { displayName })
      } catch (profileErr) {
        console.warn('Could not update displayName on Auth user:', profileErr)
      }

      await setDoc(
        doc(db, 'users', newUser.uid),
        {
          uid: newUser.uid,
          email: newUser.email,
          displayName,
          role: userRole,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      if (onProfileSetup) {
        await onProfileSetup(newUser)
      }

      setUser(newUser)
      setRole(userRole)
      return newUser
    } finally {
      activeAuthTransitionRef.current = false
      setLoading(false)
    }
  }

  const logout = async () => {
    await signOut(auth)
    setUser(null)
    setRole(null)
    setSessionError(null)
  }

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, sessionError, retrySession, signIn, signUp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
