import { useState } from 'react'
import { Send, MessageSquare, CheckCheck, Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'

interface Message {
  id: string
  senderId: string
  senderName: string
  content: string
  sentAt: string
}

interface Conversation {
  id: string
  participantName: string
  participantRole: string
  participantAvatar?: string
  positionTitle: string
  lastMessage: string
  lastMessageAt: string
  unread: boolean
  messages: Message[]
}

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    participantName: 'Prof. Sungho Kim',
    participantRole: 'Associate Professor, KAIST',
    participantAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    positionTitle: 'PhD Position — Computer Vision & Medical AI',
    lastMessage: 'Your experience with MICCAI is very promising. Are you available for a brief Zoom meeting next Tuesday?',
    lastMessageAt: '10:45 AM',
    unread: true,
    messages: [
      {
        id: 'm1',
        senderId: 'prof',
        senderName: 'Prof. Sungho Kim',
        content: 'Hello, thank you for submitting your application for our PhD opening in medical AI.',
        sentAt: 'Yesterday at 3:15 PM'
      },
      {
        id: 'm2',
        senderId: 'student',
        senderName: 'Student Applicant',
        content: 'Thank you Professor! I am very excited about your recent work on 3D diffusion models for pathology synthesis.',
        sentAt: 'Yesterday at 4:02 PM'
      },
      {
        id: 'm3',
        senderId: 'prof',
        senderName: 'Prof. Sungho Kim',
        content: 'Your experience with MICCAI is very promising. Are you available for a brief Zoom meeting next Tuesday at 2 PM KST?',
        sentAt: '10:45 AM'
      }
    ]
  },
  {
    id: 'conv-2',
    participantName: 'Prof. Emily Chen',
    participantRole: 'Full Professor, MIT',
    participantAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    positionTitle: "Master's in NLP / AI",
    lastMessage: 'We received your transcript and are reviewing it alongside other candidates.',
    lastMessageAt: 'Oct 03',
    unread: false,
    messages: [
      {
        id: 'm10',
        senderId: 'prof',
        senderName: 'Prof. Emily Chen',
        content: 'We received your transcript and are reviewing it alongside other candidates. We will update the status portal next week.',
        sentAt: 'Oct 03 at 9:00 AM'
      }
    ]
  }
]

export default function Messages() {
  const { user, role } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS)
  const [activeConvId, setActiveConvId] = useState<string>('conv-1')
  const [inputMessage, setInputMessage] = useState('')

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0]

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: role === 'professor' ? 'prof' : 'student',
      senderName: user?.displayName || 'Me',
      content: inputMessage,
      sentAt: 'Just now'
    }

    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        return {
          ...c,
          lastMessage: inputMessage,
          lastMessageAt: 'Just now',
          unread: false,
          messages: [...c.messages, newMsg]
        }
      }
      return c
    }))

    setInputMessage('')
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pt-8 pb-16 px-4 sm:px-6 max-w-7xl mx-auto flex flex-col">
      <div className="flex-1 bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 min-h-[640px]">
        
        {/* Left: Conversation list */}
        <div className="border-r border-slate-200/80 flex flex-col bg-slate-50/40">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white">
            <h1 className="font-bold text-slate-900 text-base font-display">Academic Inquiries</h1>
            <p className="text-xs text-slate-500 mt-0.5">Direct correspondence with faculty & applicants</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {conversations.map(c => {
              const active = c.id === activeConvId
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveConvId(c.id)
                    setConversations(prev => prev.map(item => item.id === c.id ? { ...item, unread: false } : item))
                  }}
                  className={`w-full p-4 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                    active ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100/60'
                  }`}
                  id={`conv-item-${c.id}`}
                >
                  <div className="relative shrink-0">
                    <Avatar src={c.participantAvatar} name={c.participantName} size="md" />
                    {c.unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs font-bold truncate ${active ? 'text-blue-900' : 'text-slate-900'}`}>{c.participantName}</h3>
                      <span className="text-[10px] text-slate-400 shrink-0">{c.lastMessageAt}</span>
                    </div>
                    <p className="text-[11px] font-medium text-blue-700 truncate mt-0.5">{c.positionTitle}</p>
                    <p className="text-xs text-slate-500 truncate mt-1">{c.lastMessage}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Message history & input */}
        <div className="md:col-span-2 lg:col-span-3 flex flex-col bg-white">
          {activeConv ? (
            <>
              {/* Active header */}
              <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <Avatar src={activeConv.participantAvatar} name={activeConv.participantName} size="md" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{activeConv.participantName}</h2>
                    <p className="text-xs text-slate-500">{activeConv.participantRole}</p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {activeConv.positionTitle}
                </span>
              </div>

              {/* Message flow */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/30">
                {activeConv.messages.map(m => {
                  const isMe = (role === 'student' && m.senderId === 'student') || (role === 'professor' && m.senderId === 'prof')
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-200/80'
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                        {m.sentAt}
                        {isMe && <CheckCheck size={12} className="text-blue-500" />}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Quick suggestions */}
              <div className="px-4 py-2.5 border-t border-slate-200/60 bg-slate-50/60 flex items-center gap-2 overflow-x-auto text-xs text-slate-500">
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick reply:</span>
                <button
                  type="button"
                  onClick={() => setInputMessage('Yes, that time works perfectly for me. Looking forward to speaking with you!')}
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-200/70 border border-slate-200 text-slate-700 shrink-0 transition-colors cursor-pointer text-xs"
                >
                  Yes, that time works for me &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setInputMessage('Could you provide the Zoom / Google Meet link?')}
                  className="px-3 py-1 rounded-full bg-white hover:bg-slate-200/70 border border-slate-200 text-slate-700 shrink-0 transition-colors cursor-pointer text-xs"
                >
                  Request meeting link &rarr;
                </button>
              </div>

              {/* Input bar */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200/80 bg-white flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  id="message-input-field"
                />
                <Button
                  type="submit"
                  size="md"
                  disabled={!inputMessage.trim()}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  id="send-message-btn"
                >
                  <Send size={14} className="mr-1" />
                  Send
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select a conversation to begin
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
