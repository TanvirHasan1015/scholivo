import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type {
  ConversationDocument,
  ConversationParticipantSummary,
  MessagingRole,
  UserDirectoryEntry,
} from '@/types/message.types'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'

export const PRIVATE_STUDENT_KEYS = [
  'email',
  'universityEmail',
  'gpa',
  'gpaScale',
  'cvUrl',
  'transcriptUrl',
  'savedProfessorIds',
] as const

export const ALLOWED_PUBLIC_STUDENT_KEYS = [
  'uid',
  'fullName',
  'username',
  'country',
  'photoURL',
  'university',
  'department',
  'major',
  'degree',
  'currentSemester',
  'expectedGraduation',
  'researchInterests',
  'researchAreas',
  'researchExperience',
  'projects',
  'publications',
  'programmingLanguages',
  'frameworks',
  'technicalSkills',
  'researchTools',
  'languageScores',
  'portfolioUrl',
  'profileCompleteness',
  'bio',
  'createdAt',
  'updatedAt',
] as const

export const ALLOWED_PUBLIC_PROFESSOR_KEYS = [
  'uid',
  'fullName',
  'username',
  'isPublicProfile',
  'academicTitle',
  'country',
  'photoURL',
  'university',
  'department',
  'faculty',
  'universityProfileUrl',
  'googleScholarUrl',
  'orcid',
  'personalWebpageUrl',
  'biography',
  'researchAreas',
  'researchInterests',
  'currentProjects',
  'publications',
  'labName',
  'labDescription',
  'labWebsiteUrl',
  'labMembers',
  'isRecruiting',
  'recruitingStatus',
  'fundingInfo',
  'createdAt',
  'updatedAt',
] as const

const ALLOWED_STUDENT_KEY_SET = new Set<string>(ALLOWED_PUBLIC_STUDENT_KEYS)
const ALLOWED_PROFESSOR_KEY_SET = new Set<string>(ALLOWED_PUBLIC_PROFESSOR_KEYS)
const PRIVATE_STUDENT_KEY_SET = new Set<string>(PRIVATE_STUDENT_KEYS)

export interface StudentPrivateRecord {
  uid: string
  email?: string
  gpa?: number
  gpaScale?: number
  cvUrl?: string
  transcriptUrl?: string
  savedProfessorIds?: string[]
  updatedAt: unknown
}

/**
 * Splits a full StudentProfile into:
 * 1) Public academic profile payload for `students/{uid}` (used for matching & discovery; NO private fields)
 * 2) Private student record payload for `studentPrivate/{uid}` (strictly owner-only)
 */
export function splitStudentProfilePayloads(
  uid: string,
  profile: Record<string, unknown>
): {
  publicPayload: Record<string, unknown>
  privatePayload: Record<string, unknown>
} {
  const publicPayload: Record<string, unknown> = { uid }
  const privatePayload: Record<string, unknown> = { uid }

  for (const [key, value] of Object.entries(profile)) {
    if (value === undefined) continue
    if (PRIVATE_STUDENT_KEY_SET.has(key)) {
      if (key !== 'universityEmail') {
        privatePayload[key] = value
      }
    } else if (ALLOWED_STUDENT_KEY_SET.has(key)) {
      publicPayload[key] = value
    }
  }

  return { publicPayload, privatePayload }
}

/**
 * Saves the authenticated student's profile across `students/{uid}` (allowlisted academic fields only)
 * and `studentPrivate/{uid}` (email, GPA, CV URL, transcript URL, savedProfessorIds).
 * Replaces `students/{uid}` with strictly allowlisted academic fields so no private or unknown keys remain.
 * If `studentPrivate/{uid}` is not yet enabled in the live project's deployed Firestore rules,
 * falls back to saving on `students/{uid}` (which is owner-only under pre-migration rules) so no data is lost.
 */
export async function saveSplitStudentProfile(
  uid: string,
  profile: Record<string, unknown>
): Promise<void> {
  if (!uid) return
  const { publicPayload, privatePayload } = splitStudentProfilePayloads(uid, profile)

  try {
    await setDoc(
      doc(db, 'studentPrivate', uid),
      {
        ...privatePayload,
        uid,
        updatedAt: profile.updatedAt || serverTimestamp(),
      },
      { merge: true }
    )
    await setDoc(doc(db, 'students', uid), publicPayload)
  } catch {
    // Fallback if `studentPrivate` rule has not yet been deployed to the live Firebase project
    await setDoc(
      doc(db, 'students', uid),
      {
        ...publicPayload,
        ...privatePayload,
        uid,
      },
      { merge: true }
    )
  }
}

/**
 * Loads the authenticated student's own profile by merging `students/{uid}` and `studentPrivate/{uid}`.
 * If legacy private or non-allowlisted fields are found on `students/{uid}`, automatically migrates
 * private fields to `studentPrivate/{uid}` and deletes all non-allowlisted fields from `students/{uid}`.
 */
export async function loadSplitStudentProfile(
  uid: string
): Promise<{ exists: boolean; data: Partial<StudentProfile> }> {
  if (!uid) return { exists: false, data: {} }

  const [publicRes, privateRes] = await Promise.allSettled([
    getDoc(doc(db, 'students', uid)),
    getDoc(doc(db, 'studentPrivate', uid)),
  ])

  const pubSnap = publicRes.status === 'fulfilled' ? publicRes.value : null
  const privSnap = privateRes.status === 'fulfilled' ? privateRes.value : null

  const pubExists = Boolean(pubSnap?.exists())
  const privExists = Boolean(privSnap?.exists())

  if (!pubExists && !privExists) {
    return { exists: false, data: {} }
  }

  const pubRaw = (pubExists ? pubSnap!.data() : {}) as Record<string, unknown>
  const privRaw = (privExists ? privSnap!.data() : {}) as Record<string, unknown>

  // Check if `students/{uid}` still holds legacy private or non-allowlisted fields and self-migrate them
  const legacyPrivateFound: Record<string, unknown> = {}
  const deletePatch: Record<string, unknown> = {}
  let needsStudentCleanup = false

  for (const key of Object.keys(pubRaw)) {
    if (PRIVATE_STUDENT_KEY_SET.has(key)) {
      needsStudentCleanup = true
      if (key !== 'universityEmail' && pubRaw[key] !== undefined && privRaw[key] === undefined) {
        legacyPrivateFound[key] = pubRaw[key]
      }
      deletePatch[key] = deleteField()
    } else if (!ALLOWED_STUDENT_KEY_SET.has(key)) {
      needsStudentCleanup = true
      deletePatch[key] = deleteField()
    }
  }

  if (
    pubExists &&
    (pubRaw.uid !== uid ||
      typeof pubRaw.fullName !== 'string' ||
      typeof pubRaw.username !== 'string' ||
      typeof pubRaw.university !== 'string' ||
      typeof pubRaw.department !== 'string')
  ) {
    needsStudentCleanup = true
  }

  if (needsStudentCleanup && pubExists) {
    deletePatch.uid = uid
    deletePatch.fullName = typeof pubRaw.fullName === 'string' ? pubRaw.fullName : ''
    deletePatch.username =
      typeof pubRaw.username === 'string' && pubRaw.username ? pubRaw.username : uid
    deletePatch.university = typeof pubRaw.university === 'string' ? pubRaw.university : ''
    deletePatch.department = typeof pubRaw.department === 'string' ? pubRaw.department : ''

    ;(async () => {
      try {
        if (Object.keys(legacyPrivateFound).length > 0) {
          await setDoc(
            doc(db, 'studentPrivate', uid),
            {
              uid,
              ...legacyPrivateFound,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        }
        await updateDoc(doc(db, 'students', uid), deletePatch)
      } catch {
        // Non-blocking background migration; never delete from `students/{uid}` if `studentPrivate` write failed
      }
    })()
  }

  const sanitizedPub: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(pubRaw)) {
    if (ALLOWED_STUDENT_KEY_SET.has(k)) {
      sanitizedPub[k] = v
    }
  }

  return {
    exists: true,
    data: {
      ...(sanitizedPub as Partial<StudentProfile>),
      ...(legacyPrivateFound as Partial<StudentProfile>),
      ...(privRaw as Partial<StudentProfile>),
      uid,
    },
  }
}

/**
 * Updates only the student's private `savedProfessorIds` in `studentPrivate/{uid}`
 * (falling back to `students/{uid}` if `studentPrivate` rules are not yet deployed).
 */
export async function saveStudentSavedProfessors(
  uid: string,
  savedProfessorIds: string[]
): Promise<void> {
  if (!uid) return
  const now = new Date().toISOString()
  try {
    await setDoc(
      doc(db, 'studentPrivate', uid),
      {
        uid,
        savedProfessorIds,
        updatedAt: now,
      },
      { merge: true }
    )
  } catch {
    await setDoc(
      doc(db, 'students', uid),
      {
        savedProfessorIds,
        updatedAt: now,
      },
      { merge: true }
    )
  }
}

/**
 * Filters a ProfessorProfile object down to strictly allowlisted public fields
 * and sets `isPublicProfile: true`.
 */
export function sanitizePublicProfessorPayload(
  uid: string,
  profile: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    uid,
    isPublicProfile: true,
  }
  for (const [key, value] of Object.entries(profile)) {
    if (value === undefined) continue
    if (ALLOWED_PROFESSOR_KEY_SET.has(key)) {
      payload[key] = value
    }
  }
  payload.uid = uid
  payload.isPublicProfile = true
  return payload
}

/**
 * Strips any legacy `email` or non-allowlisted fields from a professor's public `professors/{uid}`
 * document and marks the sanitized document with `isPublicProfile: true` for public discovery queries.
 */
export function stripLegacyProfessorEmailIfPresent(
  uid: string,
  rawProfData: Record<string, unknown>
): void {
  if (!uid) return
  const disallowedKeys = Object.keys(rawProfData).filter(
    (k) => !ALLOWED_PROFESSOR_KEY_SET.has(k)
  )
  const needsRequiredStringNormalization =
    rawProfData.uid !== uid ||
    typeof rawProfData.fullName !== 'string' ||
    typeof rawProfData.username !== 'string' ||
    typeof rawProfData.university !== 'string' ||
    typeof rawProfData.department !== 'string'

  if (
    disallowedKeys.length === 0 &&
    rawProfData.isPublicProfile === true &&
    !needsRequiredStringNormalization
  ) {
    return
  }

  const patch: Record<string, unknown> = {
    uid,
    isPublicProfile: true,
    fullName: typeof rawProfData.fullName === 'string' ? rawProfData.fullName : '',
    username:
      typeof rawProfData.username === 'string' && rawProfData.username
        ? rawProfData.username
        : uid,
    university: typeof rawProfData.university === 'string' ? rawProfData.university : '',
    department: typeof rawProfData.department === 'string' ? rawProfData.department : '',
  }
  for (const key of disallowedKeys) {
    patch[key] = deleteField()
  }
  updateDoc(doc(db, 'professors', uid), patch).catch(() => {
    // Non-blocking cleanup
  })
}

/**
 * Strips any `email` or private fields in memory from a ProfessorProfile object before returning it to the UI.
 */
function sanitizeProfessorInMemory(raw: ProfessorProfile, uid: string): ProfessorProfile {
  const clone: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'email') continue
    clone[k] = v
  }
  clone.uid = uid
  return clone as unknown as ProfessorProfile
}

/**
 * Safely and securely loads public professor profiles up to `maxCount` without executing
 * any unrestricted collection queries on `professors`.
 *
 * Security & Compatibility Architecture:
 * 1. Queries `professors` where `isPublicProfile == true` (strictly allowlisted public fields, no emails).
 * 2. Queries `userDirectory` where `role == professor` (privacy-safe directory, no emails).
 * 3. Queries `positions` (public research openings with professor details).
 * 4. For any discovered professor UID not yet loaded:
 *    - Attempts a per-document `getDoc(doc(db, 'professors', uid))` (which evaluates single-document security rules).
 *    - If `getDoc` succeeds, strips any email in memory and merges.
 *    - If `getDoc` fails or is blocked by rules (e.g. legacy document with an unmigrated email),
 *      constructs a safe public profile from the public `positions` and `userDirectory` data already retrieved.
 */
export async function fetchPublicProfessorsSafely(
  maxCount = 50
): Promise<ProfessorProfile[]> {
  const byUid = new Map<string, ProfessorProfile>()

  // Concurrently query public professors, active positions, and userDirectory
  const [publicSnapRes, posRes, dirRes] = await Promise.allSettled([
    getDocs(
      query(collection(db, 'professors'), where('isPublicProfile', '==', true), limit(maxCount))
    ),
    getDocs(query(collection(db, 'positions'), limit(100))),
    getDocs(
      query(collection(db, 'userDirectory'), where('role', '==', 'professor'), limit(maxCount))
    ),
  ])

  // A. Public professors with `isPublicProfile: true`
  if (publicSnapRes.status === 'fulfilled') {
    publicSnapRes.value.docs.forEach((d) => {
      const prof = d.data() as ProfessorProfile
      const uid = prof.uid || d.id
      if (uid) {
        byUid.set(uid, sanitizeProfessorInMemory(prof, uid))
      }
    })
  }

  // B. Collect candidate metadata from positions and userDirectory
  const directoryEntries = new Map<string, UserDirectoryEntry>()
  if (dirRes.status === 'fulfilled') {
    dirRes.value.docs.forEach((d) => {
      const data = d.data() as UserDirectoryEntry
      const uid = data.uid || d.id
      if (uid) {
        directoryEntries.set(uid, data)
      }
    })
  }

  const positionsByProfId = new Map<
    string,
    Array<{
      professorName?: string
      professorTitle?: string
      university?: string
      department?: string
      country?: string
      researchArea?: string
      researchTopics?: string[]
    }>
  >()

  if (posRes.status === 'fulfilled') {
    posRes.value.docs.forEach((d) => {
      const posData = d.data() as {
        professorId?: string
        professorName?: string
        professorTitle?: string
        university?: string
        department?: string
        country?: string
        researchArea?: string
        researchTopics?: string[]
      }
      const pId = posData.professorId
      if (pId) {
        if (!positionsByProfId.has(pId)) {
          positionsByProfId.set(pId, [])
        }
        positionsByProfId.get(pId)!.push(posData)
      }
    })
  }

  // Identify all discovered professor UIDs not yet loaded
  const candidateUids = new Set<string>()
  for (const uid of directoryEntries.keys()) {
    if (!byUid.has(uid)) candidateUids.add(uid)
  }
  for (const uid of positionsByProfId.keys()) {
    if (!byUid.has(uid)) candidateUids.add(uid)
  }

  // C. For candidate UIDs, attempt per-document `getDoc` (`allow get`)
  if (candidateUids.size > 0) {
    const targetUids = Array.from(candidateUids).slice(0, maxCount)
    const docResults = await Promise.allSettled(
      targetUids.map((uid) => getDoc(doc(db, 'professors', uid)))
    )

    docResults.forEach((res, idx) => {
      const uid = targetUids[idx]
      if (res.status === 'fulfilled' && res.value.exists()) {
        const prof = res.value.data() as ProfessorProfile
        const profUid = prof.uid || res.value.id
        if (profUid && !byUid.has(profUid)) {
          byUid.set(profUid, sanitizeProfessorInMemory(prof, profUid))
        }
      } else {
        // If `getDoc` fails or document is unmigrated, synthesize from public directory and positions
        const dir = directoryEntries.get(uid)
        const posList = positionsByProfId.get(uid) || []
        const firstPos = posList[0]

        if (dir || firstPos) {
          const areas = Array.from(
            new Set([
              ...(dir?.researchAreas || []),
              ...posList
                .flatMap((p) => [p.researchArea, ...(p.researchTopics || [])])
                .filter((x): x is string => Boolean(x)),
            ])
          )

          const synthesized: ProfessorProfile = {
            uid,
            fullName: dir?.fullName || firstPos?.professorName || 'Faculty Member',
            username: dir?.username || uid,
            academicTitle: dir?.headline || firstPos?.professorTitle || 'Professor',
            university: dir?.university || firstPos?.university || '',
            department: dir?.department || firstPos?.department || '',
            faculty: '',
            country: firstPos?.country || 'South Korea',
            photoURL: dir?.photoURL,
            biography: '',
            researchAreas: areas.slice(0, 5),
            researchInterests: areas.slice(0, 10),
            currentProjects: [],
            publications: [],
            labName: '',
            labDescription: '',
            labWebsiteUrl: '',
            labMembers: [],
            isPublicProfile: true,
            isRecruiting: true,
            recruitingStatus: 'actively_recruiting',
            createdAt: '',
            updatedAt: '',
          }
          byUid.set(uid, synthesized)
        }
      }
    })
  }

  return Array.from(byUid.values()).slice(0, maxCount)
}

/**
 * Safely resolves a single public professor profile by `username` or `uid`.
 * Uses per-document `getDoc` fallback via `userDirectory` and `positions` if
 * collection `list` is restricted by `hasOnlyAllowedProfessorProfileFields`.
 */
export async function fetchProfessorByUsernameOrIdSafely(
  usernameOrId: string
): Promise<{ profile: ProfessorProfile; uid: string } | null> {
  if (!usernameOrId) return null

  // 1. Try public query on professors where `isPublicProfile == true`
  try {
    const snap = await getDocs(
      query(
        collection(db, 'professors'),
        where('isPublicProfile', '==', true),
        where('username', '==', usernameOrId),
        limit(1)
      )
    )
    if (!snap.empty) {
      const docSnap = snap.docs[0]
      const prof = docSnap.data() as ProfessorProfile
      const uid = prof.uid || docSnap.id
      return { profile: sanitizeProfessorInMemory(prof, uid), uid }
    }
  } catch {
    // Ignore and proceed to per-document getDoc and directory resolution
  }

  // 2. Try direct document getDoc by UID (evaluated per document under `allow get`)
  try {
    const byIdSnap = await getDoc(doc(db, 'professors', usernameOrId))
    if (byIdSnap.exists()) {
      const prof = byIdSnap.data() as ProfessorProfile
      const uid = prof.uid || byIdSnap.id
      return { profile: sanitizeProfessorInMemory(prof, uid), uid }
    }
  } catch {
    // Ignore if not a valid UID or rules reject
  }

  // 3. Try userDirectory where username == usernameOrId
  try {
    const dirSnap = await getDocs(
      query(
        collection(db, 'userDirectory'),
        where('username', '==', usernameOrId),
        limit(1)
      )
    )
    if (!dirSnap.empty) {
      const dirData = dirSnap.docs[0].data() as UserDirectoryEntry
      const targetUid = dirData.uid || dirSnap.docs[0].id
      if (targetUid) {
        try {
          const profSnap = await getDoc(doc(db, 'professors', targetUid))
          if (profSnap.exists()) {
            const prof = profSnap.data() as ProfessorProfile
            return { profile: sanitizeProfessorInMemory(prof, targetUid), uid: targetUid }
          }
        } catch {
          // Fall back to synthesized profile from directory
        }

        const fallbackProf = buildDirectoryEntryFromProfessor({
          uid: targetUid,
          fullName: dirData.fullName,
          username: dirData.username,
          academicTitle: dirData.headline,
          university: dirData.university,
          department: dirData.department,
          photoURL: dirData.photoURL,
          researchAreas: dirData.researchAreas,
        })
        return {
          profile: {
            ...fallbackProf,
            academicTitle: dirData.headline || 'Professor',
            country: '',
            faculty: '',
            biography: '',
            researchInterests: dirData.researchAreas,
            currentProjects: [],
            publications: [],
            labName: '',
            labDescription: '',
            labWebsiteUrl: '',
            labMembers: [],
            isPublicProfile: true,
            isRecruiting: true,
            recruitingStatus: 'actively_recruiting',
            createdAt: '',
            updatedAt: '',
          } as ProfessorProfile,
          uid: targetUid,
        }
      }
    }
  } catch {
    // Ignore
  }

  // 4. Try discovery through fetchPublicProfessorsSafely(100)
  const allProfs = await fetchPublicProfessorsSafely(100)
  const lowerTarget = usernameOrId.toLowerCase()
  const matched = allProfs.find(
    (p) =>
      p.username === usernameOrId ||
      p.uid === usernameOrId ||
      (p.username && p.username.toLowerCase() === lowerTarget) ||
      (p.fullName && p.fullName.toLowerCase() === lowerTarget)
  )
  return matched ? { profile: matched, uid: matched.uid } : null
}

/**
 * Safely loads sanitized public student profiles for an authenticated professor.
 * First attempts a collection query on `students`; if Firestore's static query planner
 * blocks `list` because `allow list` enforces `hasOnlyAllowedStudentProfileFields`,
 * resolves student UIDs from the professor's `applications` and `userDirectory`
 * and loads each sanitized student profile via `getDoc` (`allow get`).
 */
export async function fetchPublicStudentsForProfessorSafely(
  applicationStudentIds: string[] = [],
  maxCount = 100
): Promise<StudentProfile[]> {
  const byUid = new Map<string, StudentProfile>()

  try {
    const snap = await getDocs(query(collection(db, 'students'), limit(maxCount)))
    snap.docs.forEach((d) => {
      const student = d.data() as StudentProfile
      const uid = student.uid || d.id
      if (uid) {
        byUid.set(uid, { ...student, uid })
      }
    })
    if (byUid.size > 0) {
      return Array.from(byUid.values())
    }
  } catch {
    // Fall back to per-document getDoc below
  }

  const candidateUids = new Set<string>(applicationStudentIds.filter(Boolean))
  try {
    const dirSnap = await getDocs(
      query(collection(db, 'userDirectory'), where('role', '==', 'student'), limit(maxCount))
    )
    dirSnap.docs.forEach((d) => {
      const uid = (d.data() as { uid?: string }).uid || d.id
      if (uid) candidateUids.add(uid)
    })
  } catch {
    // Ignore
  }

  const targetUids = Array.from(candidateUids).slice(0, maxCount)
  const docResults = await Promise.allSettled(
    targetUids.map((uid) => getDoc(doc(db, 'students', uid)))
  )

  docResults.forEach((res) => {
    if (res.status === 'fulfilled' && res.value.exists()) {
      const student = res.value.data() as StudentProfile
      const uid = student.uid || res.value.id
      if (uid && !byUid.has(uid)) {
        byUid.set(uid, { ...student, uid })
      }
    }
  })

  return Array.from(byUid.values())
}

/**
 * Generates a deterministic 1-to-1 conversation ID from two Firebase Auth UIDs.
 * Sorting the UIDs guarantees that (uidA, uidB) and (uidB, uidA) always map
 * to the exact same conversation document: "${sorted0}_${sorted1}".
 */
export function getConversationId(uidA: string, uidB: string): string {
  const a = uidA.trim()
  const b = uidB.trim()
  if (!a || !b || a === b) {
    throw new Error('Two distinct user IDs are required to form a conversation.')
  }
  return a < b ? `${a}_${b}` : `${b}_${a}`
}

/**
 * Builds a privacy-safe UserDirectoryEntry from a StudentProfile.
 * Uses the exact fullName, username, university, and department values from `students/{uid}`
 * so Firestore Security Rules can validate them directly against `students/{uid}`.
 */
export function buildDirectoryEntryFromStudent(
  profile: Partial<StudentProfile> & { uid: string }
): UserDirectoryEntry {
  const degreeLabel =
    profile.degree === 'PhD'
      ? 'PhD Researcher'
      : profile.degree === 'Bachelor'
      ? "Bachelor's Student"
      : "Master's Student"
  const majorPart = profile.major?.trim()
  const headline = majorPart ? `${degreeLabel} • ${majorPart}` : degreeLabel

  const entry: UserDirectoryEntry = {
    uid: profile.uid,
    fullName: typeof profile.fullName === 'string' && profile.fullName ? profile.fullName : '',
    username: typeof profile.username === 'string' && profile.username ? profile.username : profile.uid,
    role: 'student',
    university: typeof profile.university === 'string' ? profile.university : '',
    department: typeof profile.department === 'string' ? profile.department : '',
    headline,
    researchAreas: Array.isArray(profile.researchAreas)
      ? profile.researchAreas.slice(0, 10)
      : Array.isArray(profile.researchInterests)
      ? profile.researchInterests.slice(0, 10)
      : [],
    updatedAt: new Date().toISOString(),
  }

  if (profile.photoURL?.trim()) {
    entry.photoURL = profile.photoURL.trim()
  }

  return entry
}

/**
 * Builds a privacy-safe UserDirectoryEntry from a ProfessorProfile.
 * Uses the exact fullName, username, university, and department values from `professors/{uid}`
 * so Firestore Security Rules can validate them directly against `professors/{uid}`.
 */
export function buildDirectoryEntryFromProfessor(
  profile: Partial<ProfessorProfile> & { uid: string }
): UserDirectoryEntry {
  const entry: UserDirectoryEntry = {
    uid: profile.uid,
    fullName: typeof profile.fullName === 'string' && profile.fullName ? profile.fullName : '',
    username: typeof profile.username === 'string' && profile.username ? profile.username : profile.uid,
    role: 'professor',
    university: typeof profile.university === 'string' ? profile.university : '',
    department: typeof profile.department === 'string' ? profile.department : '',
    headline: (profile.academicTitle || 'Professor').trim(),
    researchAreas: Array.isArray(profile.researchAreas)
      ? profile.researchAreas.slice(0, 10)
      : Array.isArray(profile.researchInterests)
      ? profile.researchInterests.slice(0, 10)
      : [],
    updatedAt: new Date().toISOString(),
  }

  if (profile.photoURL?.trim()) {
    entry.photoURL = profile.photoURL.trim()
  }

  return entry
}

/**
 * Upserts the caller's own privacy-safe directory document at `userDirectory/{uid}`.
 * Explicitly strips any undefined fields and guarantees no private fields are written.
 */
export async function syncUserDirectoryEntry(entry: UserDirectoryEntry): Promise<void> {
  if (!entry.uid || !entry.fullName) return
  const payload: Record<string, unknown> = {
    uid: entry.uid,
    fullName: entry.fullName,
    username: entry.username,
    role: entry.role,
    university: entry.university,
    department: entry.department,
    headline: entry.headline.trim(),
    researchAreas: Array.isArray(entry.researchAreas) ? entry.researchAreas.slice(0, 10) : [],
    updatedAt: entry.updatedAt || new Date().toISOString(),
  }
  if (entry.photoURL?.trim()) {
    payload.photoURL = entry.photoURL.trim()
  }

  await setDoc(doc(db, 'userDirectory', entry.uid), payload)
}

/**
 * Converts a UserDirectoryEntry into a compact participant summary stored on a ConversationDocument.
 */
export function toParticipantSummary(entry: UserDirectoryEntry): ConversationParticipantSummary {
  const summary: ConversationParticipantSummary = {
    uid: entry.uid,
    fullName: entry.fullName || 'Scholivo Member',
    username: entry.username || entry.uid,
    role: entry.role,
    university: entry.university || '',
    department: entry.department || '',
    headline: entry.headline || (entry.role === 'professor' ? 'Professor' : 'Student'),
  }
  if (entry.photoURL) {
    summary.photoURL = entry.photoURL
  }
  return summary
}

/**
 * Resolves a single user's public directory entry by UID.
 * Checks `userDirectory/{uid}` first, then safely falls back to `professors/{uid}`
 * or `students/{uid}` (stripping any private fields in memory).
 */
export async function resolveUserDirectoryEntry(
  targetUid: string
): Promise<UserDirectoryEntry | null> {
  if (!targetUid) return null

  try {
    const dirSnap = await getDoc(doc(db, 'userDirectory', targetUid))
    if (dirSnap.exists()) {
      const data = dirSnap.data() as UserDirectoryEntry
      return {
        uid: data.uid || dirSnap.id,
        fullName: data.fullName || 'Scholivo Member',
        username: data.username || data.uid || dirSnap.id,
        role: data.role === 'professor' ? 'professor' : 'student',
        university: data.university || '',
        department: data.department || '',
        headline: data.headline || (data.role === 'professor' ? 'Professor' : 'Student'),
        ...(data.photoURL ? { photoURL: data.photoURL } : {}),
        researchAreas: Array.isArray(data.researchAreas) ? data.researchAreas : [],
        updatedAt: data.updatedAt || '',
      }
    }
  } catch {
    // Fall through to profile collection check if userDirectory read fails or doesn't exist yet
  }

  try {
    const profSnap = await getDoc(doc(db, 'professors', targetUid))
    if (profSnap.exists()) {
      const profData = profSnap.data() as ProfessorProfile
      return buildDirectoryEntryFromProfessor({
        ...profData,
        uid: profData.uid || profSnap.id,
      })
    }
  } catch {
    // Ignore and try student fallback if caller has permission
  }

  try {
    const studentSnap = await getDoc(doc(db, 'students', targetUid))
    if (studentSnap.exists()) {
      const studentData = studentSnap.data() as StudentProfile
      return buildDirectoryEntryFromStudent({
        ...studentData,
        uid: studentData.uid || studentSnap.id,
      })
    }
  } catch {
    // Ignore if caller does not have direct read access to students/{targetUid}
  }

  // Fallback: inspect public positions authored by targetUid (if target is a professor)
  try {
    const posSnap = await getDocs(
      query(collection(db, 'positions'), where('professorId', '==', targetUid), limit(1))
    )
    if (!posSnap.empty) {
      const posData = posSnap.docs[0].data() as {
        professorId?: string
        professorName?: string
        university?: string
        department?: string
        researchArea?: string
        researchTopics?: string[]
      }
      return {
        uid: targetUid,
        fullName: posData.professorName || 'Scholivo Faculty',
        username: targetUid,
        role: 'professor',
        university: posData.university || '',
        department: posData.department || '',
        headline: 'Professor',
        researchAreas: Array.isArray(posData.researchTopics)
          ? posData.researchTopics.slice(0, 10)
          : posData.researchArea
          ? [posData.researchArea]
          : [],
        updatedAt: new Date().toISOString(),
      }
    }
  } catch {
    // Ignore
  }

  return null
}

/**
 * Loads the discoverable user directory for starting a new conversation.
 * Combines `userDirectory` documents with public `professors` documents
 * (and `students` if the caller is a professor) so pre-existing accounts
 * created prior to `userDirectory` are immediately discoverable without exposing emails.
 */
export async function fetchDiscoverableUsers(
  currentUid: string,
  callerRole: MessagingRole | null
): Promise<UserDirectoryEntry[]> {
  const byUid = new Map<string, UserDirectoryEntry>()

  const tasks: Promise<void>[] = [
    getDocs(query(collection(db, 'userDirectory'), limit(100)))
      .then((snap) => {
        snap.docs.forEach((d) => {
          const data = d.data() as UserDirectoryEntry
          const uid = data.uid || d.id
          if (!uid || uid === currentUid) return
          byUid.set(uid, {
            uid,
            fullName: data.fullName || 'Scholivo Member',
            username: data.username || uid,
            role: data.role === 'professor' ? 'professor' : 'student',
            university: data.university || '',
            department: data.department || '',
            headline: data.headline || (data.role === 'professor' ? 'Professor' : 'Student'),
            ...(data.photoURL ? { photoURL: data.photoURL } : {}),
            researchAreas: Array.isArray(data.researchAreas) ? data.researchAreas : [],
            updatedAt: data.updatedAt || '',
          })
        })
      })
      .catch(() => {
        // Ignore if userDirectory is empty or not yet permitted
      }),

    fetchPublicProfessorsSafely(100)
      .then((profs) => {
        profs.forEach((prof) => {
          const uid = prof.uid
          if (!uid || uid === currentUid || byUid.has(uid)) return
          byUid.set(uid, buildDirectoryEntryFromProfessor({ ...prof, uid }))
        })
      })
      .catch(() => {
        // Ignore
      }),
  ]

  if (callerRole === 'professor') {
    tasks.push(
      fetchPublicStudentsForProfessorSafely([], 100)
        .then((students) => {
          students.forEach((student) => {
            const uid = student.uid
            if (!uid || uid === currentUid || byUid.has(uid)) return
            byUid.set(uid, buildDirectoryEntryFromStudent({ ...student, uid }))
          })
        })
        .catch(() => {
          // Ignore
        })
    )
  }

  await Promise.allSettled(tasks)

  return Array.from(byUid.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' })
  )
}

export interface SendMessageParams {
  sender: ConversationParticipantSummary
  recipient: ConversationParticipantSummary
  content: string
  contextTitle?: string
  positionId?: string
}

/**
 * Atomically sends a 1-to-1 message and creates or updates the deterministic
 * parent conversation document in Firestore.
 * - Uses sorted `[sender.uid, recipient.uid]` as `participantIds`
 * - Uses `sender.uid` (Firebase Auth UID) as `senderId` and `lastMessageSenderId`
 */
export async function sendConversationMessage({
  sender,
  recipient,
  content,
  contextTitle,
  positionId,
}: SendMessageParams): Promise<string> {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Message content cannot be empty.')
  }
  if (trimmed.length > 4000) {
    throw new Error('Message content cannot exceed 4,000 characters.')
  }

  const authUid = auth.currentUser?.uid
  const recipientUid = recipient.uid?.trim()

  if (!authUid) {
    throw new Error('You must be signed in to send a message.')
  }
  if (!recipientUid || authUid === recipientUid) {
    throw new Error('Valid sender and recipient accounts are required.')
  }

  const conversationId = getConversationId(authUid, recipientUid)
  const sortedParticipants: [string, string] =
    authUid < recipientUid ? [authUid, recipientUid] : [recipientUid, authUid]

  const convRef = doc(db, 'conversations', conversationId)
  const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'))

  const cleanSummary = (
    s: ConversationParticipantSummary,
    enforcedUid: string,
    preserveAuthoritativeStrings: boolean
  ): ConversationParticipantSummary => {
    const str = (val: string | undefined, fallback: string) => {
      if (preserveAuthoritativeStrings && typeof val === 'string' && val.length > 0) {
        return val
      }
      return (val || fallback).trim()
    }
    const base: ConversationParticipantSummary = {
      uid: enforcedUid,
      fullName: str(s.fullName, 'Scholivo Member'),
      username: str(s.username, enforcedUid),
      role: s.role === 'professor' ? 'professor' : 'student',
      university: preserveAuthoritativeStrings && typeof s.university === 'string' ? s.university : (s.university || '').trim(),
      department: preserveAuthoritativeStrings && typeof s.department === 'string' ? s.department : (s.department || '').trim(),
      headline: (s.headline || (s.role === 'professor' ? 'Professor' : 'Student')).trim(),
    }
    if (s.photoURL?.trim()) {
      base.photoURL = s.photoURL.trim()
    }
    return base
  }

  // Resolve authoritative directory/profile summaries so neither sender nor recipient
  // metadata can diverge from their actual stored profile documents.
  const [verifiedSenderDir, verifiedRecipientDir] = await Promise.all([
    resolveUserDirectoryEntry(authUid),
    resolveUserDirectoryEntry(recipientUid),
  ])

  const senderClean = cleanSummary(
    verifiedSenderDir ? toParticipantSummary(verifiedSenderDir) : sender,
    authUid,
    Boolean(verifiedSenderDir)
  )
  const recipientClean = cleanSummary(
    verifiedRecipientDir ? toParticipantSummary(verifiedRecipientDir) : recipient,
    recipientUid,
    Boolean(verifiedRecipientDir)
  )

  // Safely check whether the conversation already exists without failing when `get` on a
  // non-existent document is blocked by rules that check `resource.data`.
  let existingData: Record<string, unknown> | null = null
  let convLookupStatus = 'not_found'
  try {
    const convSnap = await getDoc(convRef)
    if (convSnap.exists()) {
      existingData = convSnap.data() as Record<string, unknown>
      convLookupStatus = 'exists_via_getDoc'
    }
  } catch (getErr) {
    convLookupStatus = `getDoc_error:${(getErr as { code?: string })?.code || 'unknown'}`
    try {
      const listSnap = await getDocs(
        query(collection(db, 'conversations'), where('participantIds', 'array-contains', authUid))
      )
      const matchedDoc = listSnap.docs.find((d) => d.id === conversationId)
      if (matchedDoc) {
        existingData = matchedDoc.data() as Record<string, unknown>
        convLookupStatus = 'exists_via_list'
      }
    } catch (listErr) {
      convLookupStatus = `list_error:${(listErr as { code?: string })?.code || 'unknown'}`
      existingData = null
    }
  }

  const msgPayload = {
    id: msgRef.id,
    conversationId,
    senderId: authUid,
    senderName: senderClean.fullName,
    content: trimmed,
    createdAt: serverTimestamp(),
  }

  const diagBase = {
    convPath: convRef.path,
    msgPath: msgRef.path,
    authUid,
    recipientUid,
    convLookupStatus,
    senderDirResolved: Boolean(verifiedSenderDir),
    recipientDirResolved: Boolean(verifiedRecipientDir),
    senderRole: senderClean.role,
    recipientRole: recipientClean.role,
    senderUsernameIsUid: senderClean.username === authUid,
    recipientUsernameIsUid: recipientClean.username === recipientUid,
    senderHasDept: Boolean(senderClean.department),
    recipientHasDept: Boolean(recipientClean.department),
  }

  if (!existingData) {
    const newConvPayload: Record<string, unknown> = {
      id: conversationId,
      participantIds: sortedParticipants,
      participants: {
        [authUid]: senderClean,
        [recipientUid]: recipientClean,
      },
      contextTitle: (contextTitle || 'Academic Inquiry').trim(),
      lastMessageId: msgRef.id,
      lastMessage: trimmed,
      lastMessageSenderId: authUid,
      lastMessageAt: serverTimestamp(),
      lastReadAt: {
        [authUid]: serverTimestamp(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    if (positionId?.trim()) {
      newConvPayload.positionId = positionId.trim()
    }
    // Commit parent conversation and initial message atomically
    const batch = writeBatch(db)
    batch.set(convRef, newConvPayload)
    batch.set(msgRef, msgPayload)
    try {
      await batch.commit()
    } catch (batchErr) {
      console.error('[Scholivo Messaging Diag] Batch failed', {
        ...diagBase,
        operation: 'create_conversation_and_first_message',
        convPayloadKeys: Object.keys(newConvPayload),
        msgPayloadKeys: Object.keys(msgPayload),
        errorCode: (batchErr as { code?: string })?.code,
        errorMessage: (batchErr as { message?: string })?.message,
      })
      throw batchErr
    }
  } else {
    const existingParticipants =
      (existingData.participants as Record<string, ConversationParticipantSummary>) || {}
    const existingReadAt = (existingData.lastReadAt as Record<string, unknown>) || {}

    const updatePayload: Record<string, unknown> = {
      participants: {
        ...existingParticipants,
        [authUid]: senderClean,
      },
      lastMessageId: msgRef.id,
      lastMessage: trimmed,
      lastMessageSenderId: authUid,
      lastMessageAt: serverTimestamp(),
      lastReadAt: {
        ...existingReadAt,
        [authUid]: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    }

    // Commit subcollection message and parent preview atomically
    const batch = writeBatch(db)
    batch.set(msgRef, msgPayload)
    batch.update(convRef, updatePayload)
    try {
      await batch.commit()
    } catch (batchErr) {
      console.error('[Scholivo Messaging Diag] Batch failed', {
        ...diagBase,
        operation: 'update_conversation_and_add_message',
        existingHasLastReadAt: 'lastReadAt' in existingData,
        existingParticipantKeys: Object.keys(existingParticipants),
        updatePayloadKeys: Object.keys(updatePayload),
        msgPayloadKeys: Object.keys(msgPayload),
        errorCode: (batchErr as { code?: string })?.code,
        errorMessage: (batchErr as { message?: string })?.message,
      })
      throw batchErr
    }
  }

  return conversationId
}

/**
 * Updates the current user's read timestamp on an existing conversation.
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!conversationId || !userId) return
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`lastReadAt.${userId}`]: serverTimestamp(),
    })
  } catch {
    // Non-critical metadata update
  }
}

function toTimestampMillis(val: unknown): number {
  if (!val) return 0
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis()
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof val === 'number') return val
  return 0
}

/**
 * Subscribes to the authenticated user's conversations and calculates the total
 * unread message count (excluding messages sent by `userId`) using `lastReadAt`.
 * Only queries message subcollections for conversations that actually have unread activity.
 */
export function subscribeToUnreadMessageCount(
  userId: string,
  onCountChange: (count: number) => void
): () => void {
  if (!userId) {
    onCountChange(0)
    return () => {}
  }

  let active = true
  let generation = 0

  const convQuery = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', userId)
  )

  const unsubscribe = onSnapshot(
    convQuery,
    async (snap) => {
      const currentGen = ++generation
      const convs = snap.docs.map((d) => ({
        ...(d.data() as ConversationDocument),
        id: d.id,
      }))

      const unreadConvs = convs.filter((c) => {
        if (!c.lastMessageSenderId || c.lastMessageSenderId === userId) return false
        const lastMsgMs = toTimestampMillis(c.lastMessageAt)
        const lastReadMs = toTimestampMillis(c.lastReadAt?.[userId])
        return lastMsgMs > lastReadMs
      })

      if (unreadConvs.length === 0) {
        if (active && currentGen === generation) onCountChange(0)
        return
      }

      const counts = await Promise.all(
        unreadConvs.map(async (c) => {
          const lastReadVal = c.lastReadAt?.[userId]
          try {
            const msgQuery = lastReadVal
              ? query(
                  collection(db, 'conversations', c.id, 'messages'),
                  where('createdAt', '>', lastReadVal),
                  orderBy('createdAt', 'asc'),
                  limit(100)
                )
              : query(
                  collection(db, 'conversations', c.id, 'messages'),
                  orderBy('createdAt', 'asc'),
                  limit(100)
                )
            const msgSnap = await getDocs(msgQuery)
            return msgSnap.docs.filter((d) => d.data().senderId !== userId).length
          } catch {
            // Fallback to 1 for this unread conversation if subcollection query fails
            return 1
          }
        })
      )

      if (active && currentGen === generation) {
        const total = counts.reduce((sum, n) => sum + n, 0)
        onCountChange(total)
      }
    },
    (err) => {
      console.error('Unread message count listener error:', err)
    }
  )

  return () => {
    active = false
    unsubscribe()
  }
}
