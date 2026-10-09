import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useRealtimeEvents } from '../lib/realtime.jsx'
import { BackIcon, EditIcon, SendIcon, SmileIcon, TrashIcon } from './icons.jsx'
import { Loading, useToast } from './ui.jsx'

const EMOJI = ['👍', '🙏', '😊', '😅', '🤔', '❗', '✅', '📎', '🎉', '😢', '🙌', '💡']
const GROUP_GAP = 5 * 60 * 1000

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

const clock = (iso) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Turns links in a comment into clickable links (everything else stays plain text).
function linkify(text) {
  return text.split(/(https?:\/\/[^\s<]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow">
        {part}
      </a>
    ) : (
      part
    ),
  )
}

// A private comment thread between the student and the teacher for one task.
// Render with key={taskId} so switching threads starts from a clean slate.
export default function Chat({ taskId, onBack }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [messages, setMessages] = useState([])
  const [peerLastRead, setPeerLastRead] = useState(0)
  const [peerOnline, setPeerOnline] = useState(false)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [fresh, setFresh] = useState(() => new Set())

  const listRef = useRef(null)
  const inputRef = useRef(null)
  const stick = useRef(true)
  const typingTimer = useRef(null)
  const lastTypingSent = useRef(0)

  const me = state.data?.me
  const peer = state.data?.peer

  // ---- load the thread --------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    api
      .get(`/tasks/${taskId}/messages`)
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, error: null, data })
        setMessages(data.messages)
        setPeerLastRead(data.peerLastRead)
        setPeerOnline(!!data.peer?.online)
      })
      .catch((error) => !cancelled && setState({ loading: false, error, data: null }))
    return () => {
      cancelled = true
      clearTimeout(typingTimer.current)
    }
  }, [taskId])

  // ---- keep the view pinned to the newest message -----------------------------------
  const scrolledOnce = useRef(false)
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || !stick.current) return
    el.scrollTo({ top: el.scrollHeight, behavior: scrolledOnce.current ? 'smooth' : 'auto' })
    if (messages.length) scrolledOnce.current = true
  }, [messages, typing])

  const onScroll = () => {
    const el = listRef.current
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90
  }

  const markRead = useCallback(() => {
    if (!document.hidden) api.post(`/tasks/${taskId}/read`).catch(() => {})
  }, [taskId])

  useEffect(() => {
    const onVisible = () => !document.hidden && markRead()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markRead])

  // ---- live events ----------------------------------------------------------------------
  useRealtimeEvents((ev) => {
    if (!state.data) return
    if (ev.type === 'message' && ev.message.taskId === taskId) {
      const m = ev.message
      setMessages((list) =>
        list.some((x) => x.id === m.id)
          ? list
          : [...list.filter((x) => !(x.pending && x.senderId === m.senderId && x.body === m.body)), m],
      )
      if (m.senderId !== me) {
        setFresh((f) => new Set(f).add(m.id))
        setTyping(false)
        markRead()
      }
    } else if (ev.type === 'message-updated' && ev.message.taskId === taskId) {
      setMessages((list) => list.map((x) => (x.id === ev.message.id ? ev.message : x)))
    } else if (ev.type === 'typing' && ev.taskId === taskId && ev.userId === peer?.id) {
      setTyping(true)
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setTyping(false), 3500)
    } else if (ev.type === 'read' && ev.taskId === taskId && ev.userId === peer?.id) {
      setPeerLastRead(ev.lastReadId)
    } else if (ev.type === 'presence' && ev.userId === peer?.id) {
      setPeerOnline(ev.online)
    }
  })

  // ---- actions ------------------------------------------------------------------------------
  const sendBody = async (body, retryId) => {
    const temp = { id: `tmp-${Date.now()}`, taskId, senderId: me, body, createdAt: new Date().toISOString(), pending: true }
    stick.current = true
    setMessages((list) => [...list.filter((x) => x.id !== retryId), temp])
    try {
      const { message } = await api.post(`/tasks/${taskId}/messages`, { body })
      setMessages((list) => {
        const rest = list.filter((x) => x.id !== temp.id)
        return rest.some((x) => x.id === message.id) ? rest : [...rest, message]
      })
      setFresh((f) => new Set(f).add(message.id))
    } catch (e) {
      setMessages((list) => list.map((x) => (x.id === temp.id ? { ...x, pending: false, failed: true } : x)))
      toast(e.message, 'error')
    }
  }

  const send = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    setShowEmoji(false)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    sendBody(body)
  }

  const onDraft = (e) => {
    setDraft(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
    const now = Date.now()
    if (now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now
      api.post(`/tasks/${taskId}/typing`).catch(() => {})
    }
  }

  const saveEdit = async () => {
    const body = editing.body.trim()
    if (!body) return
    try {
      const { message } = await api.patch(`/messages/${editing.id}`, { body })
      setMessages((list) => list.map((x) => (x.id === message.id ? message : x)))
      setEditing(null)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const remove = async (m) => {
    if (!window.confirm('Delete this comment for everyone?')) return
    try {
      const { message } = await api.delete(`/messages/${m.id}`)
      setMessages((list) => list.map((x) => (x.id === message.id ? message : x)))
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // ---- render -----------------------------------------------------------------------------------
  if (state.loading) return <Loading />
  if (state.error)
    return (
      <div className="alert bad" role="alert">
        <div>{state.error.message}</div>
      </div>
    )

  const { task } = state.data
  const lastMine = [...messages].reverse().find((m) => m.senderId === me && !m.deleted)

  const items = []
  let lastDay = ''
  messages.forEach((m, i) => {
    const day = dayLabel(m.createdAt)
    if (day !== lastDay) {
      items.push(
        <div className="chat-day" key={`day-${m.id}`}>
          <span>{day}</span>
        </div>,
      )
      lastDay = day
    }
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const gap = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) > GROUP_GAP || dayLabel(a.createdAt) !== dayLabel(b.createdAt)
    const first = !prev || prev.senderId !== m.senderId || gap(prev, m)
    const last = !next || next.senderId !== m.senderId || gap(m, next)
    const mine = m.senderId === me
    const canAct = mine && !m.deleted && !m.pending && !m.failed && editing?.id !== m.id

    let status = null
    if (m === lastMine) status = m.pending ? 'Sending…' : peerLastRead >= m.id ? 'Seen' : 'Delivered'

    items.push(
      <div key={m.id} className={`msg ${mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${fresh.has(m.id) ? 'fresh' : ''}`}>
        {!mine && (
          <span className="avatar sm" aria-hidden="true">
            {last ? initials(peer?.name) : ''}
          </span>
        )}
        <div className="msg-body">
          {m.deleted ? (
            <p className="bubble deleted">This comment was deleted</p>
          ) : editing?.id === m.id ? (
            <div className="edit-box">
              <textarea
                className="textarea"
                rows={2}
                autoFocus
                maxLength={2000}
                value={editing.body}
                aria-label="Edit comment"
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    saveEdit()
                  }
                }}
              />
              <div className="actions">
                <button className="btn small" onClick={saveEdit}>
                  Save
                </button>
                <button className="btn small secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`bubble ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}`}>{linkify(m.body)}</p>
          )}
          {m.failed ? (
            <span className="msg-meta failed">
              Not sent ·{' '}
              <button className="link-btn" onClick={() => sendBody(m.body, m.id)}>
                Retry
              </button>
            </span>
          ) : (
            last && (
              <span className="msg-meta">
                {clock(m.createdAt)}
                {m.editedAt && !m.deleted ? ' · edited' : ''}
                {status && <b className={`status ${status === 'Seen' ? 'seen' : ''}`}> · {status === 'Seen' ? '✓✓ Seen' : status === 'Delivered' ? '✓ Delivered' : status}</b>}
              </span>
            )
          )}
        </div>
        {canAct && (
          <div className="msg-actions">
            <button className="icon-btn small" aria-label="Edit comment" title="Edit" onClick={() => setEditing({ id: m.id, body: m.body })}>
              <EditIcon />
            </button>
            <button className="icon-btn small" aria-label="Delete comment" title="Delete" onClick={() => remove(m)}>
              <TrashIcon />
            </button>
          </div>
        )}
      </div>,
    )
  })

  return (
    <div className="chat">
      <header className="chat-head">
        {onBack && (
          <button className="icon-btn back" onClick={onBack} aria-label="Back to conversations">
            <BackIcon />
          </button>
        )}
        <span className="avatar" aria-hidden="true">
          {initials(peer?.name)}
          <i className={`presence ${peerOnline ? 'on' : ''}`} />
        </span>
        <div className="chat-who">
          <b>{peer?.name ?? 'No teacher assigned'}</b>
          <small>
            {peer?.role === 'teacher' ? 'Teacher' : 'Student'} ·{' '}
            <span className={peerOnline ? 'online-text' : ''}>{peerOnline ? 'Online' : 'Offline'}</span>
          </small>
        </div>
        <div className="chat-task" title={task.title}>
          <span>{task.code}</span>
          {task.title}
        </div>
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite" aria-label="Private comments">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="bubble-art" aria-hidden="true">
              💬
            </div>
            <b>No comments yet</b>
            <p>
              Ask a question or raise a concern about <i>{task.title}</i>. Only you and {peer?.name ?? 'your teacher'} can see this.
            </p>
          </div>
        )}
        {messages.length > 0 && <p className="chat-privacy">🔒 Private comments — only you and {peer?.name} can see these.</p>}
        {items}
        {typing && (
          <div className="msg theirs typing last" aria-label={`${peer?.name} is typing`}>
            <span className="avatar sm" aria-hidden="true">
              {initials(peer?.name)}
            </span>
            <div className="bubble dots">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="emoji-wrap">
          <button type="button" className="icon-btn" aria-label="Insert emoji" aria-expanded={showEmoji} onClick={() => setShowEmoji(!showEmoji)}>
            <SmileIcon />
          </button>
          {showEmoji && (
            <div className="emoji-pop" role="menu">
              {EMOJI.map((e) => (
                <button
                  type="button"
                  key={e}
                  role="menuitem"
                  onClick={() => {
                    setDraft((d) => d + e)
                    inputRef.current?.focus()
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={2000}
          disabled={!peer}
          placeholder={peer ? 'Add private comment…' : 'Nobody to message'}
          aria-label="Add a private comment"
          onChange={onDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="send-btn" disabled={!draft.trim() || !peer} aria-label="Send comment">
          <SendIcon />
        </button>
        {draft.length > 1800 && <small className="count">{draft.length}/2000</small>}
      </form>
    </div>
  )
}
