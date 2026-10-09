import { randomBytes } from 'node:crypto'

// Server-Sent Events hub: one long-lived response per open browser tab.
const connections = new Map() // userId -> Set<res>
const tickets = new Map() // one-time ticket -> { userId, exp }

// EventSource can't send an Authorization header, so the browser first trades its token for a
// short-lived one-time ticket and puts only that in the stream URL.
export function issueTicket(userId) {
  const now = Date.now()
  for (const [t, v] of tickets) if (v.exp < now) tickets.delete(t)
  const ticket = randomBytes(24).toString('hex')
  tickets.set(ticket, { userId, exp: now + 30_000 })
  return ticket
}

export function consumeTicket(ticket) {
  const found = tickets.get(ticket)
  tickets.delete(ticket)
  return found && found.exp > Date.now() ? found.userId : null
}

export const isOnline = (userId) => (connections.get(userId)?.size ?? 0) > 0

export function publish(userId, event) {
  const set = connections.get(userId)
  if (!set) return
  const frame = `data: ${JSON.stringify(event)}\n\n`
  for (const res of set) res.write(frame)
}

export function broadcast(event) {
  for (const id of connections.keys()) publish(id, event)
}

export function attach(userId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 3000\n\n')

  let set = connections.get(userId)
  const firstTab = !set
  if (!set) connections.set(userId, (set = new Set()))
  set.add(res)
  if (firstTab) broadcast({ type: 'presence', userId, online: true })

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000)
  res.on('close', () => {
    clearInterval(heartbeat)
    set.delete(res)
    if (set.size === 0) {
      connections.delete(userId)
      broadcast({ type: 'presence', userId, online: false })
    }
  })
}
