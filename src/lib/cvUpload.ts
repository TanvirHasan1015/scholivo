import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

export const MAX_CV_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_CV_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export interface CvFileValidationResult {
  valid: boolean
  contentType: string
  safeName: string
  error?: string
}

export function sanitizeCvFileName(fileName: string): string {
  const cleaned = (fileName || 'cv.pdf')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
  return cleaned || 'cv.pdf'
}

export function resolveCvContentType(file: Pick<File, 'name' | 'type'>): string | null {
  const lowerName = (file.name || '').trim().toLowerCase()
  const rawType = (file.type || '').trim().toLowerCase()

  if (lowerName.endsWith('.pdf') || rawType === ALLOWED_CV_MIME_TYPES.pdf) {
    return ALLOWED_CV_MIME_TYPES.pdf
  }
  if (lowerName.endsWith('.doc') || rawType === ALLOWED_CV_MIME_TYPES.doc) {
    return ALLOWED_CV_MIME_TYPES.doc
  }
  if (lowerName.endsWith('.docx') || rawType === ALLOWED_CV_MIME_TYPES.docx) {
    return ALLOWED_CV_MIME_TYPES.docx
  }
  return null
}

export function validateCvFile(file: File | null | undefined): CvFileValidationResult {
  if (!file) {
    return {
      valid: false,
      contentType: '',
      safeName: '',
      error: 'Please select a CV file (PDF, DOC, or DOCX) to upload.',
    }
  }

  if (file.size <= 0) {
    return {
      valid: false,
      contentType: '',
      safeName: sanitizeCvFileName(file.name),
      error: 'The selected CV file is empty. Please choose a valid PDF, DOC, or DOCX file.',
    }
  }

  if (file.size >= MAX_CV_FILE_BYTES) {
    return {
      valid: false,
      contentType: '',
      safeName: sanitizeCvFileName(file.name),
      error: 'CV file must be smaller than 10 MB.',
    }
  }

  const contentType = resolveCvContentType(file)
  if (!contentType) {
    return {
      valid: false,
      contentType: '',
      safeName: sanitizeCvFileName(file.name),
      error: 'Unsupported file format. Please upload a PDF, DOC, or DOCX document.',
    }
  }

  return {
    valid: true,
    contentType,
    safeName: sanitizeCvFileName(file.name),
  }
}

export function buildApplicationCvStoragePath(
  studentId: string,
  positionId: string,
  fileName: string,
  timestamp = Date.now()
): string {
  return `cvs/${studentId}/${positionId}/${timestamp}_${sanitizeCvFileName(fileName)}`
}

export function buildProfileCvStoragePath(
  studentId: string,
  fileName: string,
  timestamp = Date.now()
): string {
  return `cvs/${studentId}/${timestamp}_${sanitizeCvFileName(fileName)}`
}

async function uploadBlobToStorageWithTimeout(
  storagePath: string,
  blob: Blob,
  contentType: string,
  timeoutMs = 20000
): Promise<string> {
  const fileRef = storageRef(storage, storagePath)
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        Object.assign(
          new Error(
            'CV upload timed out while connecting to Firebase Storage. Please check your connection or switch to your saved profile CV.'
          ),
          { code: 'storage/timeout' }
        )
      )
    }, timeoutMs)
  })

  try {
    const uploadAndUrlPromise = (async () => {
      const snapshot = await uploadBytes(fileRef, blob, { contentType })
      const downloadUrl = await getDownloadURL(snapshot.ref)
      if (!downloadUrl || !downloadUrl.trim()) {
        throw new Error('Firebase Storage did not return a valid download URL for the uploaded CV.')
      }
      return downloadUrl.trim()
    })()

    return await Promise.race([uploadAndUrlPromise, timeoutPromise])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export async function uploadApplicationCvFile(
  studentId: string,
  positionId: string,
  file: File,
  timeoutMs = 20000
): Promise<string> {
  const validation = validateCvFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid CV file.')
  }

  const storagePath = buildApplicationCvStoragePath(studentId, positionId, validation.safeName)
  return uploadBlobToStorageWithTimeout(storagePath, file, validation.contentType, timeoutMs)
}

export async function uploadProfileCvFile(
  studentId: string,
  file: File,
  timeoutMs = 20000
): Promise<string> {
  const validation = validateCvFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid CV file.')
  }

  const storagePath = buildProfileCvStoragePath(studentId, validation.safeName)
  return uploadBlobToStorageWithTimeout(storagePath, file, validation.contentType, timeoutMs)
}

export function formatCvUploadError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : ''
  const message = err instanceof Error ? err.message : ''

  if (code === 'storage/unauthorized') {
    return 'Permission denied while uploading your CV (storage/unauthorized). Please verify your account session and that the file is a PDF, DOC, or DOCX under 10 MB.'
  }
  if (code === 'storage/canceled') {
    return 'CV upload was canceled. Please select your file and try again.'
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/timeout') {
    return (
      message ||
      'CV upload timed out while communicating with Firebase Storage. Please check your network connection and try again.'
    )
  }
  if (code === 'storage/invalid-argument' || code === 'storage/cannot-slice-blob') {
    return 'The selected CV file could not be read. Please re-select the file from your device and try again.'
  }
  return message || 'Failed to upload CV file. Please try again.'
}
