import { Router } from 'express'
import { db } from '../db.js'
import { attach, consumeTicket, isOnline, issueTicket, publish } from '../realtime.js'
import { HttpError, MESSAGE_COLUMNS, UNREAD_IN_TASK, nowIso, notify, shapeMessage } from '../util.js'
import { requireAuth } from './auth.js'

const auth = requireAuth()

// ---- live stream ---------------------------------------------------------------
export const streamRouter = Router()

streamRouter.post('/ticket', auth, (req, res) => res.json({ ticket: issueTicket(req.user.id) }))

streamRouter.get('/', (req, res) => {
  const userId = consumeTicket(String(req.query.ticket ?? ''))
  if (!userId) return res.status(401).end()
  attach(userId, res)
})

// ---- helpers ----------------------------------------------------------------------
function loadThread(taskId, user) {
  if (!['student', 'teacher'].includes(user.role)) throw new HttpError(403, 'Comments are for students and teachers.')
  const row = db
    .prepare(
      `SELECT t.id, t.student_id AS studentId, t.done, a.id AS activityId, a.title, a.teacher_id AS teacherId,
              s.code, s.description
       FROM tasks t JOIN activities a ON a.id = t.activity_id JOIN subjects s ON s.id = a.subject_id
       WHERE t.id = ?`,
    )
    .get(taskId)
  const allowed = row && (user.role === 'student' ? row.studentId === user.id : row.teacherId === user.id)
  if (!allowed) throw new HttpError(404, 'Conversation not found.')
  const peerId = user.role === 'student' ? row.teacherId : row.studentId
  const peer = peerId ? db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(peerId) : null
  return { row, peer }
}

const lastMessageId = (taskId) => db.prepare('SELECT COALESCE(MAX(id),0) AS id FROM task_messages WHERE task_id=?').get(taskId).id
const readMark = (taskId, userId) =>
  db.prepare('SELECT COALESCE(last_read_id,0) AS id FROM thread_reads WHERE task_id=? AND user_id=?').get(taskId, userId)?.id ?? 0

function markRead(taskId, user, peer) {
  const last = lastMessageId(taskId)
  const before = readMark(taskId, user.id)
  if (last <= before) return
  db.prepare(
    `INSERT INTO thread_reads (task_id, user_id, last_read_id) VALUES (?,?,?)
     ON CONFLICT(task_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`,
  ).run(taskId, user.id, last)
  if (peer) publish(peer.id, { type: 'read', taskId, userId: user.id, lastReadId: last })
  publish(user.id, { type: 'unread' }) // keeps this user's other tabs in sync
}

const sends = new Map()
function rateLimit(userId) {
  const now = Date.now()
  const recent = (sends.get(userId) || []).filter((t) => now - t < 60_000)
  if (recent.length >= 30) throw new HttpError(429, 'You’re sending messages too fast. Wait a moment.')
  recent.push(now)
  sends.set(userId, recent)
}

const cleanBody = (value) => {
  const body = String(value ?? '').replace(/\r\n/g, '\n').trim()
  if (!body) throw new HttpError(400, 'Write a comment first.')
  if (body.length > 2000) throw new HttpError(400, 'Comments can be up to 2000 characters.')
  return body
}

const messageById = (id) => shapeMessage(db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM task_messages m WHERE m.id = ?`).get(id))

export const unreadTotal = (userId) =>
  db
    .prepare(
      `SELECT COALESCE(SUM(${UNREAD_IN_TASK}), 0) AS c
       FROM tasks t JOIN activities a ON a.id = t.activity_id
       WHERE t.student_id = ? OR a.teacher_id = ?`,
    )
    .get(userId, userId, userId, userId).c

// ---- routes (students & teachers) ------------------------------------------------------
export const messagesRouter = Router()

messagesRouter.get('/messages/unread', auth, (req, res) => res.json({ unread: unreadTotal(req.user.id) }))

messagesRouter.get('/messages/inbox', auth, (req, res) => {
  if (!['student', 'teacher'].includes(req.user.role)) throw new HttpError(403, 'Comments are for students and teachers.')
  const rows = db
    .prepare(
      `SELECT t.id AS taskId, a.title, s.code, t.student_id AS studentId, a.teacher_id AS teacherId,
              us.name AS studentName, ut.name AS teacherName,
              lm.id AS lastId, lm.sender_id AS lastSender, lm.created_at AS lastAt,
              CASE WHEN lm.deleted_at IS NULL THEN lm.body ELSE '' END AS lastBody,
              (lm.deleted_at IS NOT NULL) AS lastDeleted,
              ${UNREAD_IN_TASK} AS unread
       FROM tasks t
       JOIN activities a ON a.id = t.activity_id
       JOIN subjects s ON s.id = a.subject_id
       JOIN users us ON us.id = t.student_id
       LEFT JOIN users ut ON ut.id = a.teacher_id
       JOIN task_messages lm ON lm.id = (SELECT MAX(id) FROM task_messages WHERE task_id = t.id)
       WHERE ${req.user.role === 'student' ? 't.student_id' : 'a.teacher_id'} = ?
       ORDER BY lm.id DESC`,
    )
    .all(req.user.id, req.user.id, req.user.id)
  res.json({
    threads: rows.map((r) => {
      const peerId = req.user.role === 'student' ? r.teacherId : r.studentId
      return {
        taskId: r.taskId,
        title: r.title,
        code: r.code,
        peerId,
        peerName: (req.user.role === 'student' ? r.teacherName : r.studentName) ?? 'Teacher',
        online: isOnline(peerId),
        lastBody: r.lastDeleted ? 'Message deleted' : r.lastBody,
        lastAt: r.lastAt,
        lastMine: r.lastSender === req.user.id,
        unread: r.unread,
      }
    }),
  })
})

messagesRouter.get('/tasks/:id/messages', auth, (req, res) => {
  const taskId = Number(req.params.id)
  const { row, peer } = loadThread(taskId, req.user)
  const messages = db
    .prepare(`SELECT ${MESSAGE_COLUMNS} FROM task_messages m WHERE m.task_id = ? ORDER BY m.id`)
    .all(taskId)
    .map(shapeMessage)
  const peerLastRead = peer ? readMark(taskId, peer.id) : 0
  markRead(taskId, req.user, peer)
  res.json({
    task: { id: row.id, title: row.title, code: row.code, description: row.description, done: !!row.done },
    me: req.user.id,
    peer: peer && { id: peer.id, name: peer.name, role: peer.role, online: isOnline(peer.id) },
    messages,
    peerLastRead,
  })
})

messagesRouter.post('/tasks/:id/messages', auth, (req, res) => {
  const taskId = Number(req.params.id)
  const { row, peer } = loadThread(taskId, req.user)
  if (!peer) throw new HttpError(409, 'There is nobody to send this to yet.')
  const body = cleanBody(req.body?.body)
  rateLimit(req.user.id)

  const created = db
    .prepare('INSERT INTO task_messages (task_id, sender_id, body, created_at) VALUES (?,?,?,?) RETURNING id')
    .get(taskId, req.user.id, body, nowIso())
  const message = messageById(created.id)

  // sending counts as having read everything up to here
  db.prepare(
    `INSERT INTO thread_reads (task_id, user_id, last_read_id) VALUES (?,?,?)
     ON CONFLICT(task_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`,
  ).run(taskId, req.user.id, message.id)

  publish(req.user.id, { type: 'message', message })
  publish(peer.id, { type: 'message', message })

  const link = peer.role === 'teacher' ? `/teacher/messages?task=${taskId}` : `/tasks/${taskId}`
  const alreadyUnread = db.prepare('SELECT 1 FROM notifications WHERE user_id=? AND link=? AND is_read=0').get(peer.id, link)
  if (!alreadyUnread) notify(peer.id, `${req.user.name} commented on “${row.title}”.`, link)

  res.status(201).json({ message })
})

// lightweight "I'm looking at this thread" call (used when a message arrives while the chat is open)
messagesRouter.post('/tasks/:id/read', auth, (req, res) => {
  const taskId = Number(req.params.id)
  const { peer } = loadThread(taskId, req.user)
  markRead(taskId, req.user, peer)
  res.json({ ok: true })
})

messagesRouter.post('/tasks/:id/typing', auth, (req, res) => {
  const { peer } = loadThread(Number(req.params.id), req.user)
  if (peer) publish(peer.id, { type: 'typing', taskId: Number(req.params.id), userId: req.user.id })
  res.json({ ok: true })
})

function ownMessage(id, user) {
  const msg = db.prepare('SELECT * FROM task_messages WHERE id = ?').get(id)
  if (!msg || msg.sender_id !== user.id || msg.deleted_at) throw new HttpError(404, 'Message not found.')
  const { peer } = loadThread(msg.task_id, user)
  return { msg, peer }
}

messagesRouter.patch('/messages/:id', auth, (req, res) => {
  const { msg, peer } = ownMessage(Number(req.params.id), req.user)
  db.prepare('UPDATE task_messages SET body=?, edited_at=? WHERE id=?').run(cleanBody(req.body?.body), nowIso(), msg.id)
  const message = messageById(msg.id)
  publish(req.user.id, { type: 'message-updated', message })
  if (peer) publish(peer.id, { type: 'message-updated', message })
  res.json({ message })
})

messagesRouter.delete('/messages/:id', auth, (req, res) => {
  const { msg, peer } = ownMessage(Number(req.params.id), req.user)
  db.prepare('UPDATE task_messages SET deleted_at=? WHERE id=?').run(nowIso(), msg.id)
  const message = messageById(msg.id)
  publish(req.user.id, { type: 'message-updated', message })
  if (peer) {
    publish(peer.id, { type: 'message-updated', message })
    publish(peer.id, { type: 'unread' })
  }
  res.json({ message })
})
