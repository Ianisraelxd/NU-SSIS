import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChatIcon } from '../../components/icons.jsx'
import { Async, Badge, Card, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { dueLabel, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import { useRealtimeEvents } from '../../lib/realtime.jsx'

export default function Tasks() {
  const state = useApi('/student/tasks')
  const toast = useToast()
  const [filter, setFilter] = useState('pending')

  // new comments (or a read receipt) change the badges on the cards
  useRealtimeEvents((ev) => {
    if (['message', 'message-updated', 'unread'].includes(ev.type)) state.reload()
  })

  const toggle = async (task, event) => {
    const target = event.currentTarget
    try {
      await api.post(`/student/tasks/${task.id}/toggle`)
      state.reload()
      if (!task.done) burst(target)
      toast(task.done ? 'Moved back to pending.' : 'Marked as done.')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {(d) => {
        const shown = d.tasks.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
        const pending = d.tasks.filter((t) => !t.done).length
        return (
          <>
            <PageHead title="Pending Tasks" subtitle={subtitle(d.yearLevel, d.term)}>
              <div className="segmented" role="group" aria-label="Filter tasks">
                {[
                  ['pending', `Pending (${pending})`],
                  ['done', 'Done'],
                  ['all', 'All'],
                ].map(([key, label]) => (
                  <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </PageHead>
            <div className="stack">
              {shown.length === 0 && (
                <Card>
                  <p className="empty">{filter === 'pending' ? 'Nothing pending — enjoy the break! 🎉' : 'No tasks here.'}</p>
                </Card>
              )}
              {shown.map((t) => {
                const due = dueLabel(t.dueAt)
                return (
                  <Card key={t.id} className={`task-card ${t.done ? 'done' : ''}`}>
                    <div>
                      <h3>
                        <Link to={`/tasks/${t.id}`} className="task-link">
                          {t.title}
                        </Link>
                      </h3>
                      <p className="kind">{t.kind}</p>
                      <div className="task-meta">
                        <span className="points">{t.points} Points</span>
                        {t.done ? <Badge status="Completed">Submitted</Badge> : <span className={`due ${due.late ? 'late' : ''}`}>{due.text}</span>}
                      </div>
                    </div>
                    <div className="task-side">
                      <b>
                        {t.code} : {t.description}
                      </b>
                      <span className="muted">{t.instructor}</span>
                      <div className="actions task-actions">
                        <Link className={`btn small secondary comment-btn ${t.unread ? 'has-unread' : ''}`} to={`/tasks/${t.id}`}>
                          <ChatIcon width={16} height={16} />
                          {t.unread ? `${t.unread} new` : t.comments ? `${t.comments} comment${t.comments === 1 ? '' : 's'}` : 'Add comment'}
                          {t.unread > 0 && <i className="ping" />}
                        </Link>
                        <button className={`btn small ${t.done ? 'secondary' : ''}`} onClick={(e) => toggle(t, e)}>
                          {t.done ? 'Undo' : 'Mark as done'}
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )
      }}
    </Async>
  )
}
