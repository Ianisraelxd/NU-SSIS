import { Link, useSearchParams } from 'react-router-dom'
import Chat from '../components/Chat.jsx'
import { Async, PageHead } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'
import { timeAgo } from '../lib/format.js'
import { useApi } from '../lib/hooks.js'
import { useRealtimeEvents } from '../lib/realtime.jsx'

const initials = (name = '?') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

// Every private-comment conversation in one inbox. Used by students and teachers.
export default function MessagesPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const inbox = useApi('/messages/inbox')
  const selected = Number(params.get('task')) || null

  useRealtimeEvents((ev) => {
    if (['message', 'message-updated', 'unread', 'presence'].includes(ev.type)) inbox.reload()
  })

  const emptyHint =
    user.role === 'student' ? (
      <>
        Open any activity in <Link to="/tasks">Pending Tasks</Link> and add a private comment to start a conversation with your teacher.
      </>
    ) : (
      <>
        Students’ private comments on your activities show up here. Open an activity from <Link to="/teacher/activities">Activities</Link>.
      </>
    )

  return (
    <>
      <PageHead title="Messages" subtitle="Private comments on your school activities" />
      <Async state={inbox}>
        {({ threads }) => (
          <div className={`msgs-layout ${selected ? 'has-thread' : ''}`}>
            <aside className="inbox" aria-label="Conversations">
              {threads.length === 0 && (
                <div className="empty" style={{ padding: 28 }}>
                  <p style={{ fontSize: 34 }}>💬</p>
                  <b>No conversations yet</b>
                  <p style={{ marginTop: 6 }}>{emptyHint}</p>
                </div>
              )}
              {threads.map((t) => (
                <button
                  key={t.taskId}
                  className={`thread ${selected === t.taskId ? 'active' : ''} ${t.unread ? 'unread' : ''}`}
                  onClick={() => setParams({ task: t.taskId })}
                >
                  <span className="avatar" aria-hidden="true">
                    {initials(t.peerName)}
                    <i className={`presence ${t.online ? 'on' : ''}`} />
                  </span>
                  <span className="thread-main">
                    <span className="thread-top">
                      <b>{t.peerName}</b>
                      <time>{timeAgo(t.lastAt)}</time>
                    </span>
                    <span className="thread-task">
                      {t.code} · {t.title}
                    </span>
                    <span className="thread-last">
                      {t.lastMine ? 'You: ' : ''}
                      {t.lastBody}
                    </span>
                  </span>
                  {t.unread > 0 && <span className="unread-pill">{t.unread}</span>}
                </button>
              ))}
            </aside>

            <section className="thread-pane">
              {selected ? (
                <Chat key={selected} taskId={selected} onBack={() => setParams({})} />
              ) : (
                <div className="chat chat-placeholder">
                  <div className="chat-empty">
                    <div className="bubble-art" aria-hidden="true">
                      💬
                    </div>
                    <b>Select a conversation</b>
                    <p>Pick a thread on the left to read and reply.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </Async>
    </>
  )
}
