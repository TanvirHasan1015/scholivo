import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore'
import {
  Send,
  MessageSquare,
  CheckCheck,
  Plus,
  Search,
  X,
  GraduationCap,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import {
  buildDirectoryEntryFromProfessor,
  buildDirectoryEntryFromStudent,
  fetchDiscoverableUsers,
  getConversationId,
  loadSplitStudentProfile,
  markConversationAsRead,
  resolveUserDirectoryEntry,
  sendConversationMessage,
  stripLegacyProfessorEmailIfPresent,
  syncUserDirectoryEntry,
  toParticipantSummary,
} from '@/lib/messaging'
import type {
  ConversationDocument,
  ConversationParticipantSummary,
  MessageDocument,
  MessagingRole,
  UserDirectoryEntry,
} from '@/types/message.types'
import type { ProfessorProfile, StudentProfile } from '@/types/user.types'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'

interface DraftConversation {
  id: string
  recipient: ConversationParticipantSummary
  contextTitle: string
  positionId?: string
}

function toMillis(val: unknown): number {
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

function formatTimestamp(val: unknown): string {
  const ms = toMillis(val)
  if (!ms) return 'Just now'
  const date = new Date(ms)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function resolveCounterpart(
  conv: ConversationDocument,
  currentUid?: string
): ConversationParticipantSummary {
  const otherUid = conv.participantIds?.find((id) => id !== currentUid) || ''
  const summary = (otherUid && conv.participants?.[otherUid]) || undefined
  return (
    summary || {
      uid: otherUid,
      fullName: 'Scholivo Member',
      role: 'student',
      university: '',
      headline: 'Researcher',
    }
  )
}

export default function Messages() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [mySummary, setMySummary] = useState<ConversationParticipantSummary | null>(null)
  const [conversations, setConversations] = useState<ConversationDocument[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [activeConvId, setActiveConvId] = useState<string>('')
  const [draftConv, setDraftConv] = useState<DraftConversation | null>(null)

  const [messagesState, setMessagesState] = useState<{
    convId: string
    items: MessageDocument[]
    error: string | null
  }>({
    convId: '',
    items: [],
    error: null,
  })
  const [inputMessage, setInputMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // User Directory Modal State
  const [showDirectoryModal, setShowDirectoryModal] = useState(false)
  const [directoryUsers, setDirectoryUsers] = useState<UserDirectoryEntry[]>([])
  const [loadingDirectory, setLoadingDirectory] = useState(false)
  const [directorySearch, setDirectorySearch] = useState('')
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<'all' | MessagingRole>('all')

  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const isNearBottomRef = useRef(true)
  const forceScrollBottomRef = useRef(false)
  const lastScrolledConvIdRef = useRef<string>('')
  const prevFirstMsgIdRef = useRef<string>('')
  const prevLastMsgIdRef = useRef<string>('')
  const prevScrollHeightRef = useRef<number>(0)

  // Ensure the messaging workspace always opens aligned below the navbar (not scrolled down from a previous page)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  // 1. Load current user's profile and self-sync userDirectory entry
  useEffect(() => {
    let isMounted = true

    async function initMySummary() {
      if (!user) return
      const effectiveRole: MessagingRole = role === 'professor' ? 'professor' : 'student'

      try {
        if (effectiveRole === 'professor') {
          const profSnap = await getDoc(doc(db, 'professors', user.uid))
          if (profSnap.exists()) {
            const rawProf = profSnap.data() as Record<string, unknown>
            stripLegacyProfessorEmailIfPresent(user.uid, rawProf)
            const profData = rawProf as unknown as ProfessorProfile
            const entry = buildDirectoryEntryFromProfessor({
              ...profData,
              uid: user.uid,
            })
            if (isMounted) setMySummary(toParticipantSummary(entry))
            syncUserDirectoryEntry(entry).catch(() => {})
            return
          }
        } else {
          const loadedStudent = await loadSplitStudentProfile(user.uid)
          if (loadedStudent.exists) {
            const studentData = loadedStudent.data as StudentProfile
            const entry = buildDirectoryEntryFromStudent({
              ...studentData,
              uid: user.uid,
            })
            if (isMounted) setMySummary(toParticipantSummary(entry))
            syncUserDirectoryEntry(entry).catch(() => {})
            return
          }
        }
      } catch {
        // Fallback to basic in-memory summary below
      }

      let resolvedDisplayName = user.displayName || 'Scholivo Member'
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists()) {
          const uData = userSnap.data() as { displayName?: string }
          if (uData.displayName?.trim()) {
            resolvedDisplayName = uData.displayName.trim()
          }
        }
      } catch {
        // Ignore
      }

      if (isMounted) {
        const fallbackEntry: UserDirectoryEntry = {
          uid: user.uid,
          fullName: resolvedDisplayName,
          username: user.uid,
          role: effectiveRole,
          university: '',
          department: '',
          headline: effectiveRole === 'professor' ? 'Professor' : 'Student Researcher',
          ...(user.photoURL ? { photoURL: user.photoURL } : {}),
          researchAreas: [],
          updatedAt: new Date().toISOString(),
        }
        setMySummary(toParticipantSummary(fallbackEntry))
      }
    }

    initMySummary()
    return () => {
      isMounted = false
    }
  }, [user, role])

  // 2. Real-time inbox subscription using Firestore onSnapshot
  useEffect(() => {
    const uid = user?.uid
    if (!uid) return

    const convQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', uid)
    )

    const unsubscribe = onSnapshot(
      convQuery,
      (snap) => {
        const list: ConversationDocument[] = snap.docs.map((d) => {
          const data = d.data() as ConversationDocument
          return {
            ...data,
            id: d.id,
          }
        })

        list.sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt))
        setConversations(list)
        setLoadingConvs(false)
      },
      (err) => {
        console.error('Real-time conversations listener error:', err)
        setLoadingConvs(false)
      }
    )

    return () => unsubscribe()
  }, [user?.uid])

  // 3. Handle deep-link initiation (?to=<uid>&context=<title>&positionId=<id>&name=<name>&role=<role>&university=<uni>&department=<dept>&headline=<headline>)
  useEffect(() => {
    let isMounted = true
    const targetUid = searchParams.get('to')?.trim()
    const contextParam = searchParams.get('context')?.trim()
    const positionIdParam = searchParams.get('positionId')?.trim()
    const nameParam = searchParams.get('name')?.trim()
    const usernameParam = searchParams.get('username')?.trim()
    const roleParam = searchParams.get('role')?.trim()
    const universityParam = searchParams.get('university')?.trim()
    const departmentParam = searchParams.get('department')?.trim()
    const headlineParam = searchParams.get('headline')?.trim()

    async function handleRecipientParam() {
      if (!user || !targetUid) return
      if (targetUid === user.uid) {
        setSearchParams({}, { replace: true })
        return
      }

      const deterministicId = getConversationId(user.uid, targetUid)
      const existing = conversations.find((c) => c.id === deterministicId)
      if (existing) {
        setDraftConv(null)
        setActiveConvId(deterministicId)
        setSearchParams({}, { replace: true })
        return
      }

      const resolvedEntry = await resolveUserDirectoryEntry(targetUid)
      if (!isMounted) return

      let recipientSummary: ConversationParticipantSummary | null = null
      if (resolvedEntry) {
        recipientSummary = toParticipantSummary(resolvedEntry)
      } else if (nameParam) {
        const fallbackRole: MessagingRole = roleParam === 'professor' ? 'professor' : 'student'
        recipientSummary = {
          uid: targetUid,
          fullName: nameParam,
          username: usernameParam || targetUid,
          role: fallbackRole,
          university: universityParam || '',
          department: departmentParam || '',
          headline: headlineParam || (fallbackRole === 'professor' ? 'Professor' : 'Student Researcher'),
        }
      }

      if (!recipientSummary) {
        setErrorMsg('Recipient profile could not be verified to start a conversation.')
        setSearchParams({}, { replace: true })
        return
      }

      setDraftConv({
        id: deterministicId,
        recipient: recipientSummary,
        contextTitle: contextParam || 'Academic Inquiry',
        ...(positionIdParam ? { positionId: positionIdParam } : {}),
      })
      setActiveConvId(deterministicId)
      setSearchParams({}, { replace: true })
    }

    handleRecipientParam()
    return () => {
      isMounted = false
    }
  }, [user, role, searchParams, conversations, setSearchParams])

  const visibleDraftConv = useMemo(() => {
    if (!draftConv) return null
    if (conversations.some((c) => c.id === draftConv.id)) return null
    return draftConv
  }, [draftConv, conversations])

  const effectiveActiveConvId =
    activeConvId || visibleDraftConv?.id || conversations[0]?.id || ''

  const activeExistingConv = useMemo(
    () => conversations.find((c) => c.id === effectiveActiveConvId) || null,
    [conversations, effectiveActiveConvId]
  )

  const activeExistingConvId = activeExistingConv?.id || ''

  // 4. Real-time message subscription for the active conversation using onSnapshot
  useEffect(() => {
    const uid = user?.uid
    if (!uid || !activeExistingConvId) return

    const msgQuery = query(
      collection(db, 'conversations', activeExistingConvId, 'messages'),
      orderBy('createdAt', 'asc')
    )

    const unsubscribe = onSnapshot(
      msgQuery,
      (snap) => {
        const loaded: MessageDocument[] = snap.docs.map((d) => ({
          ...(d.data() as MessageDocument),
          id: d.id,
        }))
        setMessagesState({
          convId: activeExistingConvId,
          items: loaded,
          error: null,
        })
      },
      (err) => {
        console.error('Real-time messages listener error:', err)
        const msg = (err as { message?: string })?.message || 'Unable to load message history.'
        setMessagesState({
          convId: activeExistingConvId,
          items: [],
          error: `Failed to load message history: ${msg}`,
        })
      }
    )

    return () => unsubscribe()
  }, [user?.uid, activeExistingConvId])

  // 5. Mark active conversation as read only when it has unread activity from the counterpart
  const activeLastMsgMs = toMillis(activeExistingConv?.lastMessageAt)
  const activeLastReadMs = toMillis(user?.uid ? activeExistingConv?.lastReadAt?.[user.uid] : undefined)
  const activeLastSenderId = activeExistingConv?.lastMessageSenderId || ''

  useEffect(() => {
    const uid = user?.uid
    if (!uid || !activeExistingConvId) return
    if (activeLastSenderId && activeLastSenderId !== uid && activeLastMsgMs > activeLastReadMs) {
      markConversationAsRead(activeExistingConvId, uid)
    }
  }, [user?.uid, activeExistingConvId, activeLastSenderId, activeLastMsgMs, activeLastReadMs])

  const isMessagesLoading = Boolean(
    activeExistingConvId && messagesState.convId !== activeExistingConvId
  )
  const messagesError =
    activeExistingConvId && messagesState.convId === activeExistingConvId
      ? messagesState.error
      : null
  const displayedMessages = useMemo(
    () =>
      activeExistingConvId && messagesState.convId === activeExistingConvId
        ? messagesState.items
        : [],
    [activeExistingConvId, messagesState.convId, messagesState.items]
  )

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    isNearBottomRef.current = distanceFromBottom <= 96
  }

  // Scroll only the internal message container (never the document/window)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || isMessagesLoading) return

    const convChanged = lastScrolledConvIdRef.current !== effectiveActiveConvId
    const firstMsgId = displayedMessages[0]?.id || ''
    const lastMsgId = displayedMessages[displayedMessages.length - 1]?.id || ''
    const lastMsgSenderId = displayedMessages[displayedMessages.length - 1]?.senderId || ''

    if (convChanged) {
      lastScrolledConvIdRef.current = effectiveActiveConvId
      isNearBottomRef.current = true
      forceScrollBottomRef.current = false
      container.scrollTop = container.scrollHeight
    } else if (
      prevFirstMsgIdRef.current &&
      firstMsgId &&
      firstMsgId !== prevFirstMsgIdRef.current &&
      lastMsgId === prevLastMsgIdRef.current
    ) {
      // Older messages were prepended: preserve current reading position
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current
      if (heightDiff > 0) {
        container.scrollTop += heightDiff
      }
    } else if (
      forceScrollBottomRef.current ||
      (lastMsgId &&
        lastMsgId !== prevLastMsgIdRef.current &&
        (isNearBottomRef.current || lastMsgSenderId === user?.uid))
    ) {
      forceScrollBottomRef.current = false
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }

    prevFirstMsgIdRef.current = firstMsgId
    prevLastMsgIdRef.current = lastMsgId
    prevScrollHeightRef.current = container.scrollHeight
  }, [displayedMessages, effectiveActiveConvId, isMessagesLoading, user?.uid])

  const isConversationUnread = (conv: ConversationDocument): boolean => {
    if (!user) return false
    if (conv.lastMessageSenderId === user.uid) return false
    const lastMsgMs = toMillis(conv.lastMessageAt)
    const lastReadMs = toMillis(conv.lastReadAt?.[user.uid])
    return lastMsgMs > lastReadMs
  }

  const activeCounterpart: ConversationParticipantSummary | null = useMemo(() => {
    if (activeExistingConv) return resolveCounterpart(activeExistingConv, user?.uid)
    if (visibleDraftConv && visibleDraftConv.id === effectiveActiveConvId) {
      return visibleDraftConv.recipient
    }
    return null
  }, [activeExistingConv, visibleDraftConv, effectiveActiveConvId, user?.uid])

  const activeContextTitle =
    activeExistingConv?.contextTitle ||
    (visibleDraftConv && visibleDraftConv.id === effectiveActiveConvId
      ? visibleDraftConv.contextTitle
      : 'Academic Inquiry')

  const handleOpenDirectoryModal = async () => {
    if (!user) return
    setShowDirectoryModal(true)
    setLoadingDirectory(true)
    try {
      const effectiveRole: MessagingRole = role === 'professor' ? 'professor' : 'student'
      const list = await fetchDiscoverableUsers(user.uid, effectiveRole)
      setDirectoryUsers(list)
    } catch (err) {
      console.error('Failed to load user directory:', err)
    } finally {
      setLoadingDirectory(false)
    }
  }

  const filteredDirectoryUsers = useMemo(() => {
    const q = directorySearch.trim().toLowerCase()
    return directoryUsers.filter((entry) => {
      if (directoryRoleFilter !== 'all' && entry.role !== directoryRoleFilter) return false
      if (!q) return true
      return (
        entry.fullName.toLowerCase().includes(q) ||
        entry.username.toLowerCase().includes(q) ||
        entry.university.toLowerCase().includes(q) ||
        entry.department.toLowerCase().includes(q) ||
        entry.headline.toLowerCase().includes(q) ||
        entry.researchAreas.some((area) => area.toLowerCase().includes(q))
      )
    })
  }, [directoryUsers, directorySearch, directoryRoleFilter])

  const handleSelectDirectoryUser = (entry: UserDirectoryEntry) => {
    if (!user || entry.uid === user.uid) return
    const convId = getConversationId(user.uid, entry.uid)
    const existing = conversations.find((c) => c.id === convId)
    if (existing) {
      setDraftConv(null)
      setActiveConvId(convId)
    } else {
      setDraftConv({
        id: convId,
        recipient: toParticipantSummary(entry),
        contextTitle: entry.role === 'professor' ? `${entry.fullName} Lab Inquiry` : 'Research Collaboration',
      })
      setActiveConvId(convId)
    }
    setShowDirectoryModal(false)
    setDirectorySearch('')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || !user || !activeCounterpart || !inputMessage.trim()) return

    const contentToSend = inputMessage.trim()
    setSending(true)
    setErrorMsg(null)

    const senderSummary: ConversationParticipantSummary = mySummary || {
      uid: user.uid,
      fullName: user.displayName || 'Scholivo Member',
      username: user.uid,
      role: role === 'professor' ? 'professor' : 'student',
      university: '',
      headline: role === 'professor' ? 'Professor' : 'Student Researcher',
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    }

    try {
      const convId = await sendConversationMessage({
        sender: senderSummary,
        recipient: activeCounterpart,
        content: contentToSend,
        contextTitle: activeContextTitle,
        positionId: activeExistingConv?.positionId || draftConv?.positionId,
      })
      forceScrollBottomRef.current = true
      setInputMessage('')
      setDraftConv(null)
      setActiveConvId(convId)
    } catch (err) {
      console.error('Failed to send message:', err)
      const fbErr = err as { code?: string; message?: string } | null
      const code = fbErr?.code || 'unknown'
      const detail = fbErr?.message || 'Unexpected error while sending message.'
      if (code.includes('permission-denied')) {
        setErrorMsg(`Message write blocked (${code}): ${detail}`)
      } else {
        setErrorMsg(`Failed to send message (${code}): ${detail}`)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-slate-50/70 py-4 px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1440px] mx-auto w-full flex flex-col">
      {errorMsg && (
        <div className="mb-3 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs font-medium text-rose-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="md:h-[calc(100dvh-6.25rem)] md:min-h-[460px] md:max-h-[860px] bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4">
        {/* Left: Conversation list */}
        <div className="border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col max-h-60 md:max-h-none min-h-0 overflow-hidden bg-slate-50/40">
          <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 text-base font-display truncate">Academic Inquiries</h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate">Direct correspondence with faculty & students</p>
            </div>
            <Button
              size="sm"
              onClick={handleOpenDirectoryModal}
              className="text-xs flex items-center gap-1.5 shrink-0"
              id="new-message-btn"
            >
              <Plus size={14} />
              <span>New</span>
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100">
            {loadingConvs ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Loading conversations…</p>
              </div>
            ) : conversations.length === 0 && !visibleDraftConv ? (
              <div className="p-8 text-center space-y-3">
                <MessageSquare size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No conversations yet</p>
                <p className="text-[11px] text-slate-400">
                  Start a conversation with any student or professor in the Scholivo directory.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDirectoryModal}
                  className="text-xs mt-1"
                >
                  Start New Conversation
                </Button>
              </div>
            ) : (
              <>
                {visibleDraftConv && (
                  <div
                    className={`w-full p-4 transition-colors flex items-start gap-3 ${
                      effectiveActiveConvId === visibleDraftConv.id
                        ? 'bg-blue-50/80 border-l-4 border-blue-600'
                        : 'hover:bg-slate-100/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveConvId(visibleDraftConv.id)}
                      className="flex-1 min-w-0 text-left flex items-start gap-3 cursor-pointer"
                    >
                      <Avatar
                        src={visibleDraftConv.recipient.photoURL}
                        name={visibleDraftConv.recipient.fullName}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="text-xs font-bold text-blue-900 truncate">
                            {visibleDraftConv.recipient.fullName}
                          </h3>
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                            Draft
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-blue-700 truncate mt-0.5">
                          {visibleDraftConv.contextTitle}
                        </p>
                        <p className="text-xs text-slate-400 italic truncate mt-1">
                          Write your first message…
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      title="Discard draft"
                      aria-label="Discard draft conversation"
                      onClick={() => {
                        setDraftConv(null)
                        if (activeConvId === visibleDraftConv.id) {
                          setActiveConvId(conversations[0]?.id || '')
                        }
                        setErrorMsg(null)
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 cursor-pointer shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {conversations.map((c) => {
                  const counterpart = resolveCounterpart(c, user?.uid)
                  const active = c.id === effectiveActiveConvId
                  const unread = isConversationUnread(c)
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setActiveConvId(c.id)
                        if (user && unread) markConversationAsRead(c.id, user.uid)
                      }}
                      className={`w-full p-4 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                        active ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100/60'
                      }`}
                      id={`conv-item-${c.id}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          src={counterpart.photoURL}
                          name={counterpart.fullName}
                          size="md"
                        />
                        {unread && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3
                            className={`text-xs font-bold truncate ${
                              active ? 'text-blue-900' : 'text-slate-900'
                            }`}
                          >
                            {counterpart.fullName}
                          </h3>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatTimestamp(c.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-blue-700 truncate mt-0.5">
                          {c.contextTitle || counterpart.headline || 'Academic Inquiry'}
                        </p>
                        <p
                          className={`text-xs truncate mt-1 ${
                            unread ? 'font-semibold text-slate-800' : 'text-slate-500'
                          }`}
                        >
                          {c.lastMessageSenderId === user?.uid ? `You: ${c.lastMessage}` : c.lastMessage}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Right: Message history & input */}
        <div className="md:col-span-2 lg:col-span-3 flex flex-col h-[62dvh] min-h-[380px] md:h-full md:min-h-0 overflow-hidden bg-white">
          {activeCounterpart ? (
            <>
              {/* Active header */}
              <div className="px-4 py-3.5 sm:px-5 border-b border-slate-200/80 flex items-center justify-between gap-3 bg-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={activeCounterpart.photoURL}
                    name={activeCounterpart.fullName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {activeCounterpart.fullName}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${
                          activeCounterpart.role === 'professor'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {activeCounterpart.role === 'professor' ? 'Professor' : 'Student'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {[activeCounterpart.headline, activeCounterpart.university]
                        .filter(Boolean)
                        .join(' • ') || 'Scholivo Researcher'}
                    </p>
                  </div>
                </div>

                <span
                  title={activeContextTitle}
                  className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 max-w-[240px] truncate shrink-0"
                >
                  {activeContextTitle}
                </span>
              </div>

              {/* Message flow */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 bg-slate-50/30"
              >
                {isMessagesLoading ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">Loading message history…</p>
                  </div>
                ) : messagesError ? (
                  <div className="py-8 px-4 max-w-md mx-auto bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-1.5">
                    <AlertCircle size={20} className="text-rose-600 mx-auto" />
                    <p className="text-xs font-semibold text-rose-800">Could Not Load Messages</p>
                    <p className="text-[11px] text-rose-700">{messagesError}</p>
                  </div>
                ) : displayedMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-1.5">
                    <p className="text-xs font-semibold text-slate-600">
                      Start your conversation with {activeCounterpart.fullName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Messages are private to the two participants in this thread.
                    </p>
                  </div>
                ) : (
                  displayedMessages.map((m) => {
                    const isMe = m.senderId === user?.uid
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap break-words ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80'
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                          {formatTimestamp(m.createdAt)}
                          {isMe && <CheckCheck size={12} className="text-blue-500" />}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Input bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 sm:p-4 border-t border-slate-200/80 bg-white flex items-center gap-3 shrink-0"
              >
                <input
                  type="text"
                  placeholder={`Message ${activeCounterpart.fullName}…`}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  maxLength={4000}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  id="message-input-field"
                />
                <Button
                  type="submit"
                  size="md"
                  loading={sending}
                  disabled={!inputMessage.trim() || sending}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  id="send-message-btn"
                >
                  <Send size={14} className="mr-1" />
                  Send
                </Button>
              </form>
            </>
          ) : loadingConvs ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
              <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading conversations…</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <MessageSquare size={26} />
              </div>
              <h2 className="text-base font-bold text-slate-800 font-display">
                No Active Conversation Selected
              </h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Connect directly with professors or fellow students across the Scholivo research community.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleOpenDirectoryModal}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>New Message</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(role === 'professor' ? '/dashboard/professor' : '/search')}
                  className="text-xs"
                >
                  {role === 'professor' ? 'Back to Dashboard' : 'Explore Faculty Directory'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Directory Modal for Starting 1-to-1 Conversations */}
      {showDirectoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold font-display text-slate-900">
                  New Academic Conversation
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Message any registered student or professor on Scholivo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search by name, university, department, or research area…"
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  id="directory-search-input"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(['all', 'professor', 'student'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDirectoryRoleFilter(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      directoryRoleFilter === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'all'
                      ? 'All Members'
                      : tab === 'professor'
                      ? 'Professors'
                      : 'Students'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {loadingDirectory ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Loading researcher directory…</p>
                </div>
              ) : filteredDirectoryUsers.length === 0 ? (
                <div className="py-12 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-600">No matching members found</p>
                  <p className="text-[11px] text-slate-400">
                    Try adjusting your search keywords or role filter.
                  </p>
                </div>
              ) : (
                filteredDirectoryUsers.map((entry) => (
                  <button
                    key={entry.uid}
                    type="button"
                    onClick={() => handleSelectDirectoryUser(entry)}
                    className="w-full p-3 rounded-2xl hover:bg-blue-50/60 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer"
                    id={`directory-user-${entry.uid}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={entry.photoURL} name={entry.fullName} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {entry.fullName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              entry.role === 'professor'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {entry.role === 'professor' ? (
                              <GraduationCap size={10} />
                            ) : (
                              <UserIcon size={10} />
                            )}
                            {entry.role === 'professor' ? 'Professor' : 'Student'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          {[entry.headline, entry.university, entry.department]
                            .filter(Boolean)
                            .join(' • ') || 'Scholivo Member'}
                        </p>
                        {entry.researchAreas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.researchAreas.slice(0, 3).map((area) => (
                              <span
                                key={area}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-blue-600 shrink-0 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200">
                      Message
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
