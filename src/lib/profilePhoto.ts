import { updateProfile } from 'firebase/auth'
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage'
import { auth, storage } from '@/lib/firebase'

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB

const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export const PROFILE_PHOTO_UPDATED_EVENT = 'scholivo:profile-photo-updated'

export function validateProfilePhotoFile(file: File): {
  valid: boolean
  contentType: string
  error?: string
} {
  const lower = file.name.toLowerCase()
  const hasAllowedExt =
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  const hasAllowedMime = Boolean(file.type && ALLOWED_PHOTO_MIME_TYPES.has(file.type.toLowerCase()))

  if (!hasAllowedExt || (file.type && !hasAllowedMime)) {
    return {
      valid: false,
      contentType: '',
      error: 'Please select a valid JPEG, JPG, PNG, or WebP image file.',
    }
  }

  if (file.size <= 0) {
    return {
      valid: false,
      contentType: '',
      error: 'Selected image file is empty.',
    }
  }

  if (file.size >= MAX_PROFILE_PHOTO_BYTES) {
    return {
      valid: false,
      contentType: '',
      error: 'Profile image must be smaller than 5 MB.',
    }
  }

  const contentType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
    ? 'image/webp'
    : 'image/jpeg'

  return { valid: true, contentType }
}

export function notifyProfilePhotoChanged(uid: string, photoURL: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<{ uid: string; photoURL: string }>(PROFILE_PHOTO_UPDATED_EVENT, {
      detail: { uid, photoURL },
    })
  )
}

export async function uploadUserProfilePhoto(
  uid: string,
  file: File,
  timeoutMs = 25000
): Promise<string> {
  if (!uid) {
    throw new Error('You must be signed in to upload a profile photo.')
  }
  const check = validateProfilePhotoFile(file)
  if (!check.valid) {
    throw new Error(check.error || 'Invalid profile image file.')
  }

  // Deterministic path per user avoids orphaned files when replacing a photo
  const fileRef = storageRef(storage, `profilePhotos/${uid}/profile`)
  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: check.contentType,
  })

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      uploadTask.cancel()
      const err = new Error('Profile photo upload timed out.') as Error & { code: string }
      err.code = 'storage/timeout'
      reject(err)
    }, timeoutMs)

    uploadTask.on(
      'state_changed',
      undefined,
      (err) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        reject(err)
      },
      () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve()
      }
    )
  })

  const downloadUrl = await getDownloadURL(fileRef)

  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, { photoURL: downloadUrl }).catch(() => {
      // Non-blocking Auth profile sync
    })
  }
  notifyProfilePhotoChanged(uid, downloadUrl)

  return downloadUrl
}

export async function removeUserProfilePhoto(uid: string): Promise<void> {
  if (!uid) return
  const fileRef = storageRef(storage, `profilePhotos/${uid}/profile`)
  try {
    await deleteObject(fileRef)
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code !== 'storage/object-not-found') {
      throw err
    }
  }

  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, { photoURL: '' }).catch(() => {
      // Non-blocking Auth profile sync
    })
  }
  notifyProfilePhotoChanged(uid, '')
}
