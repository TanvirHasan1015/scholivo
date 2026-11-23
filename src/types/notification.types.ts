export type NotificationType =
  | 'application_submitted'
  | 'application_status_changed'
  | 'interview_scheduled'
  | 'interview_rescheduled'

export interface AppNotification {
  id: string
  recipientId: string
  actorId: string
  type: NotificationType
  title: string
  description: string
  applicationId: string
  positionId: string
  isRead: boolean
  createdAt: string
  readAt?: string
}
