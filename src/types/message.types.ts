export type MessagingRole = 'student' | 'professor'

export interface UserDirectoryEntry {
  uid: string
  fullName: string
  username: string
  role: MessagingRole
  university: string
  department: string
  headline: string
  photoURL?: string
  researchAreas: string[]
  updatedAt: string
}

export interface ConversationParticipantSummary {
  uid: string
  fullName: string
  username?: string
  role: MessagingRole
  university?: string
  department?: string
  headline?: string
  photoURL?: string
}

export interface ConversationDocument {
  id: string
  participantIds: [string, string]
  participants: Record<string, ConversationParticipantSummary>
  contextTitle: string
  positionId?: string
  lastMessageId?: string
  lastMessage: string
  lastMessageSenderId: string
  lastMessageAt: unknown
  lastReadAt?: Record<string, unknown>
  createdAt: unknown
  updatedAt: unknown
}

export interface MessageDocument {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  createdAt: unknown
}

