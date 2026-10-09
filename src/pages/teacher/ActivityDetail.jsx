import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Chat from '../../components/Chat.jsx'
import { Async, Badge, Card, PageHead, Stat, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime, timeAgo } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import { useRealtimeEvents } from '../../lib/realtime.jsx'

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export default function ActivityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const state = useApi(`/teacher/activities/${id}`)
  const [picked, setPicked] = useState(null)

  useRealtimeEvents((ev) => {
    if (['message', 'unread', 'message-updated'].includes(ev.type)) state.reload()
  })

  const remove = async (activity) => {
    if (!window.confirm(`Delete “${activity.title}”? Students will lose it, along with every comment on it.`)) return
    try {
      await api.delete(`/teacher/activities/${activity.id}`)
      toast('Activity deleted.')
      navigate('/teacher/activities')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {({ activity, students, term }) => {
        const selected = students.find((s) => s.taskId === picked) ?? students.find((s) => s.unread > 0) ?? students.find((s) => s.messages > 0) ?? students[0]
        return (
          <>
            <PageHead title={activity.title} subtitle={`${activity.code} : ${activity.description} · ${term}`}>
              <div className="actions">
                <Link className="btn secondary" to="/teacher/activities">
                  ← Activities
                </Link>
                <button className="btn danger" onClick={() => remove(activity)}>
                  Delete
                </button>
              </div>
            </PageHead>

            <div className="stack">
              <div className="grid stats">
                <Stat label="Points" value={activity.points} />
                <Stat label="Due" value={new Date(activity.dueAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} hint={fmtDateTime(activity.dueAt)} />
                <Stat label="Marked done" value={`${activity.done} of ${activity.students}`} tone="ok" />
                <Stat label="Unread comments" value={activity.unread} tone={activity.unread ? 'warn' : 'ok'} />
              </div>
              {activity.instructions && (
                <Card title="Instructions">
                  <p className="instructions">{activity.instructions}</p>
                </Card>
              )}

              <div className="msgs-layout activity-chat">
                <aside className="inbox" aria-label="Students">
                  {students.length === 0 && <p className="empty">No students are enrolled in this subject.</p>}
                  {students.map((s) => (
                    <button
                      key={s.taskId}
                      className={`thread ${selected?.taskId === s.taskId ? 'active' : ''} ${s.unread ? 'unread' : ''}`}
                      onClick={() => setPicked(s.taskId)}
                    >
                      <span className="avatar" aria-hidden="true">
                        {initials(s.name)}
                      </span>
                      <span className="thread-main">
                        <span className="thread-top">
                          <b>{s.name}</b>
                          {s.lastAt && <time>{timeAgo(s.lastAt)}</time>}
                        </span>
                        <span className="thread-task">{s.studentNo}</span>
                        <span className="thread-last">
                          {s.done ? '✓ Marked done' : 'Not yet done'} · {s.messages} comment{s.messages === 1 ? '' : 's'}
                        </span>
                      </span>
                      {s.unread > 0 ? <span className="unread-pill">{s.unread}</span> : s.done ? <Badge status="Completed">Done</Badge> : null}
                    </button>
                  ))}
                </aside>
                <section className="thread-pane">{selected && <Chat key={selected.taskId} taskId={selected.taskId} />}</section>
              </div>
            </div>
          </>
        )
      }}
    </Async>
  )
}
