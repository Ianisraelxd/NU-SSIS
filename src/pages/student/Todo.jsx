import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Async, Badge, Card, PageHead } from '../../components/ui.jsx'
import { fmtDate, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

// Pending Tasks = what the student still has to do with the school's services.
export default function Todo() {
  const state = useApi('/student/todo')
  const [filter, setFilter] = useState('All')

  return (
    <Async state={state}>
      {(d) => {
        const categories = ['All', ...new Set(d.items.map((i) => i.category))]
        const shown = d.items.filter((i) => filter === 'All' || i.category === filter)
        return (
          <>
            <PageHead title="Pending Tasks" subtitle={subtitle(d.yearLevel, d.term)}>
              {categories.length > 2 && (
                <div className="segmented" role="group" aria-label="Filter tasks">
                  {categories.map((c) => (
                    <button key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </PageHead>
            <div className="stack">
              {shown.length === 0 && (
                <Card>
                  <p className="empty">You’re all set — nothing pending right now. 🎉</p>
                </Card>
              )}
              {shown.map((t) => (
                <Card key={t.id} className="task-card">
                  <div>
                    <h3>{t.title}</h3>
                    <p className="kind">
                      {t.category} · {t.detail}
                    </p>
                    <div className="task-meta">
                      <Badge tone={t.severity === 'high' ? 'bad' : 'warn'}>{t.severity === 'high' ? 'Needs attention' : 'To do'}</Badge>
                      {t.dueDate && <span className="due late">Due {fmtDate(t.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="task-side">
                    <div className="actions task-actions">
                      <Link className="btn small" to={t.link}>
                        {t.action}
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )
      }}
    </Async>
  )
}
