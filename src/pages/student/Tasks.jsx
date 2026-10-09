import { useState } from 'react'
import { Async, Badge, Card, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { dueLabel, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function Tasks() {
  const state = useApi('/student/tasks')
  const toast = useToast()
  const [filter, setFilter] = useState('pending')

  const toggle = async (task) => {
    try {
      await api.post(`/student/tasks/${task.id}/toggle`)
      state.reload()
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
                      <h3>{t.title}</h3>
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
                      <div style={{ marginTop: 12 }}>
                        <button className={`btn small ${t.done ? 'secondary' : ''}`} onClick={() => toggle(t)}>
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
