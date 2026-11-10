import type { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type AuthCredential,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, db, googleProvider } from '@/lib/firebase'
import type { UserRole } from '@/types/user.types'

export type ExistingAccountStatus =
  | 'new_user'
  | 'incomplete_onboarding'
  | 'existing_complete'
  | 'inconsistent'

export interface AccountInspectionResult {
  status: ExistingAccountStatus
  role: UserRole | null
  hasUserDoc: boolean
  hasStudentProfile: boolean
  hasProfessorProfile: boolean
  inconsistencyReason?: string
}

export interface GoogleSignInResult {
  user: User
  role: UserRole | null
  accountStatus: Exclude<ExistingAccountStatus, 'inconsistent'>
  isNewUser: boolean
}

export interface PendingGoogleLinkInfo {
  email: string | null
  existingMethods: string[]
}

interface AuthContextValue {
  user: User | null
  role: UserRole | null
  loading: boolean
  pendingGoogleLink: PendingGoogleLinkInfo | null
  signIn: (email: string, password: string) => Promise<UserRole | null>
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<User>
  signInWithGoogle: () => Promise<GoogleSignInResult>
  completeGoogleSignUp: (displayName: string, role: UserRole) => Promise<User>
  inspectUserAccount: (uid: string) => Promise<AccountInspectionResult>
  linkPendingGoogleCredential: () => Promise<void>
  clearPendingGoogleLink: () => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<AuthCredential | null>(null)
  const [pendingGoogleLink, setPendingGoogleLink] = useState<PendingGoogleLinkInfo | null>(null)

  const inspectUserAccount = async (uid: string): Promise<AccountInspectionResult> => {
    const [userSnap, studentSnap, professorSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'students', uid)),
      getDoc(doc(db, 'professors', uid)),
    ])

    const hasUserDoc = userSnap.exists()
    const hasStudentProfile = studentSnap.exists()
    const hasProfessorProfile = professorSnap.exists()

    if (!hasUserDoc && !hasStudentProfile && !hasProfessorProfile) {
      return {
        status: 'new_user',
        role: null,
        hasUserDoc: false,
        hasStudentProfile: false,
        hasProfessorProfile: false,
      }
    }

    if (hasStudentProfile && hasProfessorProfile) {
      return {
        status: 'inconsistent',
        role: null,
        hasUserDoc,
        hasStudentProfile: true,
        hasProfessorProfile: true,
        inconsistencyReason:
          'Account has both a student profile and a professor profile in Firestore. Please contact support to resolve this conflict.',
      }
    }

    if (!hasUserDoc && (hasStudentProfile || hasProfessorProfile)) {
      return {
        status: 'inconsistent',
        role: null,
        hasUserDoc: false,
        hasStudentProfile,
        hasProfessorProfile,
        inconsistencyReason:
          'A role profile exists without a corresponding base user record in Firestore. Please contact support.',
      }
    }

    const rawRole = userSnap.data()?.role as unknown
    if (rawRole !== 'student' && rawRole !== 'professor' && rawRole !== 'admin') {
      return {
        status: 'inconsistent',
        role: null,
        hasUserDoc: true,
        hasStudentProfile,
        hasProfessorProfile,
        inconsistencyReason:
          'Base user record has a missing or invalid role in Firestore. Please contact support.',
      }
    }

    const userRole: UserRole = rawRole

    if (userRole === 'student' && hasProfessorProfile) {
      return {
        status: 'inconsistent',
        role: null,
        hasUserDoc: true,
        hasStudentProfile,
        hasProfessorProfile: true,
        inconsistencyReason:
          'User role is set to "student" in users/{uid}, but a professor profile exists in professors/{uid}.',
      }
    }

    if (userRole === 'professor' && hasStudentProfile) {
      return {
        status: 'inconsistent',
        role: null,
        hasUserDoc: true,
        hasStudentProfile: true,
        hasProfessorProfile,
        inconsistencyReason:
          'User role is set to "professor" in users/{uid}, but a student profile exists in students/{uid}.',
      }
    }

    if (userRole === 'student' && !hasStudentProfile) {
      return {
        status: 'incomplete_onboarding',
        role: 'student',
        hasUserDoc: true,
        hasStudentProfile: false,
        hasProfessorProfile: false,
      }
    }

    if (userRole === 'professor' && !hasProfessorProfile) {
      return {
        status: 'incomplete_onboarding',
        role: 'professor',
        hasUserDoc: true,
        hasStudentProfile: false,
        hasProfessorProfile: false,
      }
    }

    return {
      status: 'existing_complete',
      role: userRole,
      hasUserDoc: true,
      hasStudentProfile,
      hasProfessorProfile,
    }
  }

  const fetchRole = async (uid: string): Promise<UserRole | null> => {
    try {
      const inspection = await inspectUserAccount(uid)
      if (inspection.status === 'existing_complete') {
        return inspection.role
      }
      if (inspection.status === 'inconsistent') {
        console.error('Inconsistent account records detected:', inspection.inconsistencyReason)
      }
    } catch (e) {
      console.error('Failed to fetch role:', e)
    }
    return null
  }

  useEffect(() => {
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

  const signIn = async (email: string, password: string): Promise<UserRole | null> => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const resolvedRole = await fetchRole(credential.user.uid)
    setUser(credential.user)
    setRole(resolvedRole)
    return resolvedRole
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

  const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
    try {
      const credential = await signInWithPopup(auth, googleProvider)
      const googleUser = credential.user

      const inspection = await inspectUserAccount(googleUser.uid)

      if (inspection.status === 'inconsistent') {
        setRole(null)
        const err = new Error(
          inspection.inconsistencyReason ||
            'Inconsistent user profile records were found. Please contact support.'
        ) as Error & { code: string }
        err.code = 'auth/inconsistent-account-records'
        throw err
      }

      if (inspection.status === 'existing_complete') {
        setUser(googleUser)
        setRole(inspection.role)
        return {
          user: googleUser,
          role: inspection.role,
          accountStatus: 'existing_complete',
          isNewUser: false,
        }
      }

      if (inspection.status === 'incomplete_onboarding') {
        setUser(googleUser)
        setRole(null)
        return {
          user: googleUser,
          role: inspection.role,
          accountStatus: 'incomplete_onboarding',
          isNewUser: false,
        }
      }

      setUser(googleUser)
      setRole(null)
      return {
        user: googleUser,
        role: null,
        accountStatus: 'new_user',
        isNewUser: true,
      }
    } catch (err: unknown) {
      const fbErr = err as FirebaseError & { customData?: { email?: string } }
      if (fbErr?.code === 'auth/account-exists-with-different-credential') {
        const conflictEmail = fbErr.customData?.email || null
        const pendingCred = GoogleAuthProvider.credentialFromError(fbErr)
        let existingMethods: string[] = []
        if (conflictEmail) {
          try {
            existingMethods = await fetchSignInMethodsForEmail(auth, conflictEmail)
          } catch {
            existingMethods = ['password']
          }
        }
        setPendingGoogleCredential(pendingCred)
        setPendingGoogleLink({
          email: conflictEmail,
          existingMethods: existingMethods.length > 0 ? existingMethods : ['password'],
        })
      }
      throw err
    }
  }

  const completeGoogleSignUp = async (
    displayName: string,
    userRole: UserRole
  ): Promise<User> => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      const err = new Error('No authenticated Google user found. Please sign in with Google first.') as Error & {
        code: string
      }
      err.code = 'auth/no-current-user'
      throw err
    }

    const inspection = await inspectUserAccount(currentUser.uid)

    if (inspection.status === 'inconsistent') {
      const err = new Error(
        inspection.inconsistencyReason ||
          'Inconsistent account records found in Firestore. Registration cannot proceed.'
      ) as Error & { code: string }
      err.code = 'auth/inconsistent-account-records'
      throw err
    }

    if (inspection.status === 'existing_complete') {
      const err = new Error(
        'An account profile already exists for this Google user and cannot be overwritten.'
      ) as Error & { code: string }
      err.code = 'auth/profile-already-exists'
      throw err
    }

    if (inspection.status === 'incomplete_onboarding') {
      if (inspection.role && inspection.role !== userRole) {
        const err = new Error(
          `This account already started registration with role "${inspection.role}" and cannot be changed to "${userRole}".`
        ) as Error & { code: string }
        err.code = 'auth/role-conflict'
        throw err
      }
      // Do not overwrite the existing users/{uid} document; only update Auth displayName if needed
      if (displayName && currentUser.displayName !== displayName) {
        await updateProfile(currentUser, { displayName })
      }
      setRole(userRole)
      return currentUser
    }

    if (displayName && currentUser.displayName !== displayName) {
      await updateProfile(currentUser, { displayName })
    }

    await setDoc(doc(db, 'users', currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: displayName || currentUser.displayName || '',
      role: userRole,
      photoURL: currentUser.photoURL || null,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    setRole(userRole)
    return currentUser
  }

  const linkPendingGoogleCredential = async (): Promise<void> => {
    const currentUser = auth.currentUser
    if (!currentUser || !pendingGoogleCredential) {
      const err = new Error(
        'Please sign in with your existing email and password first before linking your Google account.'
      ) as Error & { code: string }
      err.code = 'auth/no-pending-credential'
      throw err
    }

    if (
      pendingGoogleLink?.email &&
      currentUser.email &&
      pendingGoogleLink.email.toLowerCase() !== currentUser.email.toLowerCase()
    ) {
      const err = new Error(
        `The signed-in account (${currentUser.email}) does not match the Google account email (${pendingGoogleLink.email}) awaiting linking.`
      ) as Error & { code: string }
      err.code = 'auth/email-mismatch'
      throw err
    }

    const linkedResult = await linkWithCredential(currentUser, pendingGoogleCredential)
    setUser(linkedResult.user)
    setPendingGoogleCredential(null)
    setPendingGoogleLink(null)
  }

  const clearPendingGoogleLink = () => {
    setPendingGoogleCredential(null)
    setPendingGoogleLink(null)
  }

  const logout = async () => {
    setPendingGoogleCredential(null)
    setPendingGoogleLink(null)
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
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        pendingGoogleLink,
        signIn,
        signUp,
        signInWithGoogle,
        completeGoogleSignUp,
        inspectUserAccount,
        linkPendingGoogleCredential,
        clearPendingGoogleLink,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
