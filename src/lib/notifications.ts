import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppNotification } from '@/types/notification.types'

export function subscribeToUserNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!userId) {
    onUpdate([])
    return () => {}
  }

  const q = query(
    collection(db, 'users', userId, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(40)
  )

  return onSnapshot(
    q,
    (snap) => {
      const list: AppNotification[] = snap.docs.map((d) => ({
        ...(d.data() as AppNotification),
        id: d.id,
      }))
      onUpdate(list)
    },
    (err) => {
      console.error('Notifications listener error:', err)
      onError?.(err)
    }
  )
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return
  await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), {
    isRead: true,
    readAt: new Date().toISOString(),
  })
}

export async function markAllNotificationsAsRead(
  userId: string,
  unreadIds: string[]
): Promise<void> {
  if (!userId || unreadIds.length === 0) return
  const batch = writeBatch(db)
  const now = new Date().toISOString()
  for (const id of unreadIds) {
    batch.update(doc(db, 'users', userId, 'notifications', id), {
      isRead: true,
      readAt: now,
    })
  }
  await batch.commit()
}

export function formatInterviewDateTime(isoString?: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function toDateTimeLocalInputValue(isoString?: string): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function validateMeetingUrl(rawUrl: string): {
  valid: boolean
  normalized: string
  error?: string
} {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { valid: true, normalized: '' }
  }
  if (trimmed.length > 500) {
    return { valid: false, normalized: trimmed, error: 'Meeting URL must be 500 characters or fewer.' }
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, normalized: trimmed, error: 'Meeting URL must not contain spaces.' }
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        valid: false,
        normalized: trimmed,
        error: 'Meeting URL must start with https:// or http:// (e.g., https://zoom.us/j/...).',
      }
    }
    return { valid: true, normalized: trimmed }
  } catch {
    return {
      valid: false,
      normalized: trimmed,
      error: 'Please enter a valid Zoom or meeting URL (e.g., https://zoom.us/j/123456789).',
    }
  }
}
