import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { useAuth } from './auth.jsx'

const RealtimeContext = createContext({ unread: 0, connected: false, subscribe: () => () => {}, refreshUnread: () => {} })
export const useRealtime = () => useContext(RealtimeContext)

// Subscribe a component to live events from the server (new messages, typing, read receipts, …).
export function useRealtimeEvents(handler) {
  const { subscribe } = useRealtime()
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe])
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth()
  const enabled = !!user && (user.role === 'student' || user.role === 'teacher')
  const listeners = useRef(new Set())
  const [unread, setUnread] = useState(0)
  const [connected, setConnected] = useState(false)

  const refreshUnread = useCallback(() => {
    api
      .get('/messages/unread')
      .then((d) => setUnread(d.unread))
      .catch(() => {})
  }, [])

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let source
    let retry
    let closed = false

    const connect = async () => {
      try {
        const { ticket } = await api.post('/stream/ticket')
        if (closed) return
        source = new EventSource(`/api/stream?ticket=${ticket}`)
        source.onopen = () => {
          setConnected(true)
          refreshUnread()
        }
        source.onmessage = (e) => {
          const event = JSON.parse(e.data)
          if (['message', 'message-updated', 'unread', 'read'].includes(event.type)) refreshUnread()
          listeners.current.forEach((fn) => fn(event))
        }
        source.onerror = () => {
          source.close()
          setConnected(false)
          if (!closed) retry = setTimeout(connect, 3000) // a new one-time ticket is needed to reconnect
        }
      } catch {
        if (!closed) retry = setTimeout(connect, 5000)
      }
    }

    connect()
    refreshUnread()
    return () => {
      closed = true
      clearTimeout(retry)
      source?.close()
      setConnected(false)
    }
  }, [enabled, refreshUnread])

  const value = useMemo(() => ({ unread: enabled ? unread : 0, connected, subscribe, refreshUnread }), [enabled, unread, connected, subscribe, refreshUnread])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
