import { Link, useParams } from 'react-router-dom'
import Chat from '../../components/Chat.jsx'
import { Async, Badge, Card, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { dueLabel, fmtDateTime, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function TaskDetail() {
  const { id } = useParams()
  const state = useApi(`/student/tasks/${id}`)
  const toast = useToast()

  const toggle = async (task, event) => {
    const target = event.currentTarget
    try {
      const res = await api.post(`/student/tasks/${task.id}/toggle`)
      if (res.done) burst(target)
      toast(res.done ? 'Marked as done. Your teacher was notified.' : 'Moved back to pending.')
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {({ task, yearLevel, term }) => {
        const due = dueLabel(task.dueAt)
        return (
          <>
            <PageHead title={task.title} subtitle={subtitle(yearLevel, term)}>
              <Link className="btn secondary" to="/tasks">
                ← All tasks
              </Link>
            </PageHead>
            <div className="grid task-split">
              <Card title="Activity details">
                <dl className="kv">
                  <dt>Subject</dt>
                  <dd>
                    {task.code} : {task.description}
                  </dd>
                  <dt>Teacher</dt>
                  <dd>{task.instructor}</dd>
                  <dt>Type</dt>
                  <dd>{task.kind}</dd>
                  <dt>Points</dt>
                  <dd style={{ color: 'var(--warn)' }}>{task.points} points</dd>
                  <dt>Due</dt>
                  <dd className={due.late && !task.done ? 'late-text' : ''}>{fmtDateTime(task.dueAt)}</dd>
                  <dt>Status</dt>
                  <dd>{task.done ? <Badge status="Completed">Done · {fmtDateTime(task.doneAt)}</Badge> : <Badge status="Pending">Pending</Badge>}</dd>
                </dl>
                <h3 className="mini-title">Instructions</h3>
                <p className="instructions">{task.instructions || 'No instructions were added for this activity.'}</p>
                <button className={`btn ${task.done ? 'secondary' : ''}`} onClick={(e) => toggle(task, e)} style={{ marginTop: 18 }}>
                  {task.done ? 'Undo — mark as not done' : 'Mark as done'}
                </button>
              </Card>

              <Card title="Private comments" sub={`Chat with ${task.instructor} about this activity`} className="chat-card">
                <Chat taskId={task.id} />
              </Card>
            </div>
          </>
        )
      }}
    </Async>
  )
}
