import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Search, MessageCircle, Shield, User, Briefcase, ChevronLeft, RefreshCw } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { messagesAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ── Role badge configs ───────────────────────────────────
const ROLE_CONFIG = {
  Admin:   { label: 'Administrateur', color: '#E24B4A', bgClass: 'bg-red-100 text-red-700',   icon: Shield },
  Agent:   { label: 'Agent',          color: '#1D8C5E', bgClass: 'bg-green-100 text-green-700', icon: Briefcase },
  Citoyen: { label: 'Citoyen',        color: '#E8873A', bgClass: 'bg-orange-100 text-orange-700', icon: User },
}

function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || { label: role, bgClass: 'bg-gray-100 text-gray-700' }
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${cfg.bgClass}`}>
      {Icon && <Icon size={9} />} {cfg.label}
    </span>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 max-w-[80px] bg-muted border border-border rounded-[10px] self-start rounded-tl-sm">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-t3 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

export default function MessageriePanel({ role, initialContactId, initialContactRole }) {
  const { user: authUser } = useAuth()
  const [contacts,     setContacts]     = useState([])
  const [conversations, setConversations] = useState([])
  const [activeThread, setActiveThread] = useState(null) // { partner, messages: [] }
  const [msgInput,     setMsgInput]     = useState('')
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [sending,      setSending]      = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [showMobile,   setShowMobile]   = useState(false) // mobile: show chat panel
  const messagesEndRef = useRef(null)
  const activeThreadRef = useRef(activeThread)

  useEffect(() => {
    activeThreadRef.current = activeThread
  }, [activeThread])

  // ── Load contacts + conversations ───────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, convoRes] = await Promise.all([
        messagesAPI.getContacts(),
        messagesAPI.getConversations(),
      ])
      const contactsList = Array.isArray(contactsRes?.data) ? contactsRes.data : []
      const convoList    = Array.isArray(convoRes?.data)    ? convoRes.data    : []
      setContacts(contactsList)
      setConversations(convoList)
    } catch (e) {
      console.warn('MessageriePanel: loadData error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Polling silencieux (toutes les 4s) ──────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const convoRes = await messagesAPI.getConversations()
        setConversations(Array.isArray(convoRes?.data) ? convoRes.data : [])

        const currentActive = activeThreadRef.current
        if (currentActive && currentActive.partner) {
          const res = await messagesAPI.getThread(String(currentActive.partner._id))
          const msgs = Array.isArray(res?.data) ? res.data : []
          setActiveThread(prev => {
            if (!prev || String(prev.partner._id) !== String(currentActive.partner._id)) return prev
            // Keep pending optimistic messages
            const tempMsgs = prev.messages.filter(m => m.temp)
            const newArray = [...msgs, ...tempMsgs]
            // Update only if different to prevent scroll jumps
            if (newArray.length !== prev.messages.length || JSON.stringify(newArray[newArray.length-1]) !== JSON.stringify(prev.messages[prev.messages.length-1])) {
              return { ...prev, messages: newArray }
            }
            return prev
          })
          
          // Clear notification count on active open thread
          setConversations(prev => prev.map(c =>
            String(c.partner._id) === String(currentActive.partner._id) ? { ...c, unreadCount: 0 } : c
          ))
        }
      } catch (err) { }
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // ── Handle initialContactId prop ─────────────────────────
  useEffect(() => {
    if (initialContactId && initialContactRole && !loading) {
      // Find contact in list or create synthetic entry
      const found = contacts.find(c => String(c._id) === String(initialContactId))
      if (found) {
        openThread(found)
      } else if (initialContactId) {
        // Fallback: open thread directly
        openThread({ _id: initialContactId, role: initialContactRole, name: '...' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContactId, initialContactRole, loading])

  // ── Scroll to bottom on new messages ─────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeThread?.messages])

  // ── Open a thread ────────────────────────────────────────
  async function openThread(partner) {
    setActiveThread({ partner, messages: [] })
    setShowMobile(true)
    setThreadLoading(true)
    try {
      const res = await messagesAPI.getThread(String(partner._id))
      const msgs = Array.isArray(res?.data) ? res.data : []
      setActiveThread({ partner, messages: msgs })
      // Update unread count in conversations
      setConversations(prev => prev.map(c =>
        String(c.partner._id) === String(partner._id)
          ? { ...c, unreadCount: 0 }
          : c
      ))
    } catch {
      setActiveThread({ partner, messages: [] })
    } finally {
      setThreadLoading(false)
    }
  }

  // ── Send message ─────────────────────────────────────────
  async function sendMsg() {
    if (!msgInput.trim() || !activeThread || sending) return
    const text = msgInput.trim()
    setMsgInput('')
    setSending(true)

    // Optimistic update
    const tempMsg = {
      _id:          `temp-${Date.now()}`,
      senderId:     authUser?._id || authUser?.id,
      senderRole:   authUser?.role,
      receiverId:   activeThread.partner._id,
      receiverRole: activeThread.partner.role,
      text,
      isRead:       false,
      createdAt:    new Date().toISOString(),
      temp:         true,
    }
    setActiveThread(prev => ({ ...prev, messages: [...prev.messages, tempMsg] }))

    try {
      const res = await messagesAPI.send(
        activeThread.partner._id,
        activeThread.partner.role,
        text
      )
      const saved = res?.data || tempMsg
      setActiveThread(prev => ({
        ...prev,
        messages: prev.messages.map(m => m._id === tempMsg._id ? saved : m),
      }))
    } catch (err) {
      // Remove temp message on error
      setActiveThread(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m._id !== tempMsg._id),
      }))
    } finally {
      setSending(false)
    }
  }

  // ── Build sidebar items: conversations + contacts not yet in convos ─
  const convoPartnerIds = new Set(conversations.map(c => String(c.partner._id)))
  const extraContacts = contacts.filter(c => !convoPartnerIds.has(String(c._id)))

  const allItems = [
    ...conversations.map(c => ({ ...c.partner, lastMsg: c.lastMessage?.text, unread: c.unreadCount, isConvo: true })),
    ...extraContacts.map(c => ({ ...c, lastMsg: null, unread: 0, isConvo: false })),
  ]

  const filteredItems = search.trim()
    ? allItems.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : allItems

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-syne text-xl font-bold">Messagerie</h1>
          <p className="text-[13px] text-t3 mt-0.5">
            {totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Toutes vos conversations'}
          </p>
        </div>
        <button onClick={loadData} className="p-2 rounded-[8px] border border-border text-t3 hover:bg-surface-2 transition-colors" title="Actualiser">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 bg-white border border-border rounded-card overflow-hidden shadow-sm" style={{ minHeight: 520 }}>

        {/* ── LEFT: Contact list ──────────────────────────── */}
        <div className={`border-r border-border flex flex-col ${showMobile ? 'hidden lg:flex' : 'flex'}`}>

          {/* Search bar */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-2">
              <Search size={13} className="text-t3 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un contact…"
                className="bg-transparent border-none outline-none text-[12.5px] w-full font-dm"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scroll">
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-2.5 p-2.5 rounded-[8px] animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-t3">
                <MessageCircle size={32} className="mb-2 opacity-30" />
                <p className="text-[13px] font-medium">Aucun contact disponible</p>
                <p className="text-[12px] mt-1 text-center px-4">
                  {role === 'Citoyen'
                    ? 'Soumettez une réclamation pour contacter un agent'
                    : 'Aucune conversation pour le moment'}
                </p>
              </div>
            ) : (
              filteredItems.map(item => {
                const isActive = activeThread && String(activeThread.partner._id) === String(item._id)
                const cfg = ROLE_CONFIG[item.role] || { color: '#888' }
                return (
                  <div
                    key={String(item._id)}
                    onClick={() => openThread(item)}
                    className={`flex items-start gap-3 px-3.5 py-3 cursor-pointer border-b border-border transition-colors ${isActive ? 'bg-primary/[0.06] border-l-2 border-l-primary' : 'hover:bg-surface-2'}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={item.name} color={cfg.color} size={36} />
                      {item.unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-danger text-white rounded-full flex items-center justify-center">
                          {item.unread > 9 ? '9+' : item.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-[13px] font-medium truncate ${item.unread > 0 ? 'font-semibold text-t1' : 'text-t2'}`}>
                          {item.name}
                        </span>
                      </div>
                      <RolePill role={item.role} />
                      {item.lastMsg && (
                        <p className={`text-[11.5px] mt-0.5 truncate ${item.unread > 0 ? 'text-t2 font-medium' : 'text-t3'}`}>
                          {item.lastMsg.substring(0, 32)}{item.lastMsg.length > 32 ? '…' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: Chat area ─────────────────────────────── */}
        <div className={`flex flex-col ${!showMobile ? 'hidden lg:flex' : 'flex'}`}>
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-t3 gap-3 p-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle size={28} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-syne font-bold text-t1 mb-1">Sélectionnez une conversation</p>
                <p className="text-[13px] text-t3">Choisissez un contact dans la liste pour commencer à discuter</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-surface-2/50">
                <button
                  onClick={() => { setShowMobile(false); setActiveThread(null) }}
                  className="lg:hidden p-1.5 rounded-[6px] hover:bg-surface-2 transition-colors text-t3"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="relative">
                  <Avatar
                    name={activeThread.partner.name}
                    color={ROLE_CONFIG[activeThread.partner.role]?.color || '#888'}
                    size={38}
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-t1 truncate">{activeThread.partner.name}</p>
                  <RolePill role={activeThread.partner.role} />
                </div>
                <div className="shrink-0">
                  <span className="text-[11px] text-success font-medium">● En ligne</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-y-auto custom-scroll" style={{ maxHeight: 380 }}>
                {threadLoading ? (
                  <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <div className={`h-8 rounded-[10px] animate-pulse bg-muted ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
                      </div>
                    ))}
                  </div>
                ) : activeThread.messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-t3 gap-2 py-8">
                    <MessageCircle size={24} className="opacity-30" />
                    <p className="text-[13px]">Aucun message. Commencez la conversation !</p>
                  </div>
                ) : (
                  <>
                    {activeThread.messages.map((msg, idx) => {
                      const isMine = String(msg.senderId) === String(authUser?._id || authUser?.id)
                      const showDate = idx === 0 || (
                        new Date(msg.createdAt).toDateString() !==
                        new Date(activeThread.messages[idx - 1]?.createdAt).toDateString()
                      )
                      return (
                        <div key={msg._id || idx}>
                          {showDate && (
                            <div className="flex items-center gap-2 my-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10.5px] text-t3 font-medium px-2">
                                {new Date(msg.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`relative group max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                              <div className={`px-3.5 py-2.5 rounded-[12px] text-[13.5px] leading-relaxed break-words ${
                                isMine
                                  ? 'bg-primary text-white rounded-tr-sm shadow-sm'
                                  : 'bg-muted border border-border text-t1 rounded-tl-sm'
                              } ${msg.temp ? 'opacity-70' : ''}`}>
                                {msg.text}
                              </div>
                              <span className={`text-[10px] text-t3 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? 'text-right' : 'text-left'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                {isMine && !msg.temp && (msg.isRead ? ' · Lu' : ' · Envoyé')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {sending && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border bg-surface-2/50">
                <div className="flex items-center gap-2">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
                    placeholder={`Message à ${activeThread.partner.name}…`}
                    className="flex-1 bg-white border border-border-2 rounded-full px-4 py-2.5 text-[13.5px] outline-none font-dm focus:border-primary transition-colors"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMsg}
                    disabled={!msgInput.trim() || sending}
                    className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Send size={15} className={sending ? 'animate-pulse' : ''} />
                  </button>
                </div>
                <p className="text-[11px] text-t3 mt-1.5 px-1">Appuyez sur Entrée pour envoyer</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
