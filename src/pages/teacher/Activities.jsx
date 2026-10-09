import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Async, Badge, Card, Field, Modal, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import { useRealtimeEvents } from '../../lib/realtime.jsx'

const KINDS = ['Assignment', 'Finals Assignment', 'Quiz', 'Project', 'Laboratory']

// <input type="datetime-local"> value for "tomorrow, 11:59 PM"
function defaultDue() {
  const d = new Date(Date.now() + 86400000 * 3)
  d.setHours(23, 59, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function NewActivity({ onClose, onCreated }) {
  const toast = useToast()
  const subjects = useApi('/teacher/subjects')
  const [form, setForm] = useState({ subjectId: '', title: '', kind: 'Assignment', points: 100, dueAt: defaultDue(), instructions: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const subjectId = Number(form.subjectId || subjects.data?.[0]?.id)
      const res = await api.post('/teacher/activities', { ...form, subjectId, points: Number(form.points), dueAt: new Date(form.dueAt).toISOString() })
      toast(`Posted to ${res.students} student${res.students === 1 ? '' : 's'}.`)
      burst(e.nativeEvent.submitter)
      onCreated()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="New activity" onClose={onClose}>
      <form onSubmit={save} noValidate>
        <Async state={subjects}>
          {(list) => (
            <>
              <Field label="Subject" htmlFor="na-subject">
                <select id="na-subject" className="select" value={form.subjectId || list[0]?.id} onChange={set('subjectId')}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} : {s.description}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" htmlFor="na-title">
                <input id="na-title" className="input" maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Midterm Laboratory Exercise" />
              </Field>
              <div className="row">
                <Field label="Type" htmlFor="na-kind">
                  <select id="na-kind" className="select" value={form.kind} onChange={set('kind')}>
                    {KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Points" htmlFor="na-points">
                  <input id="na-points" type="number" min="1" max="1000" className="input" value={form.points} onChange={set('points')} />
                </Field>
              </div>
              <Field label="Due" htmlFor="na-due">
                <input id="na-due" type="datetime-local" className="input" value={form.dueAt} onChange={set('dueAt')} />
              </Field>
              <Field label="Instructions (optional)" htmlFor="na-ins">
                <textarea id="na-ins" className="textarea" maxLength={2000} value={form.instructions} onChange={set('instructions')} />
              </Field>
              {error && (
                <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
                  {error}
                </p>
              )}
              <div className="actions" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn" disabled={busy || !list.length}>
                  {busy ? 'Posting…' : 'Post to class'}
                </button>
              </div>
            </>
          )}
        </Async>
      </form>
    </Modal>
  )
}

export default function Activities() {
  const state = useApi('/teacher/activities')
  const [creating, setCreating] = useState(false)

  useRealtimeEvents((ev) => {
    if (['message', 'unread'].includes(ev.type)) state.reload()
  })

  return (
    <>
      <PageHead title="Activities" subtitle="Everything you have posted this term">
        <button className="btn" onClick={() => setCreating(true)}>
          + New activity
        </button>
      </PageHead>
      <Async state={state}>
        {({ activities }) => (
          <div className="stack">
            {activities.length === 0 && (
              <Card>
                <p className="empty">You haven’t posted any activities yet.</p>
              </Card>
            )}
            {activities.map((a) => {
              const percent = a.students ? Math.round((a.done / a.students) * 100) : 0
              return (
                <Card key={a.id} className="activity-card">
                  <div className="activity-main">
                    <h3>
                      <Link to={`/teacher/activities/${a.id}`} className="task-link">
                        {a.title}
                      </Link>{' '}
                      {a.unread > 0 && <Badge tone="bad">{a.unread} new comment{a.unread === 1 ? '' : 's'}</Badge>}
                    </h3>
                    <p className="muted">
                      {a.code} : {a.description} · {a.kind} · {a.points} points
                    </p>
                    <p className="muted">Due {fmtDateTime(a.dueAt)}</p>
                  </div>
                  <div className="activity-progress">
                    <div className="progress-row compact">
                      <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.title} completion`}>
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <b>
                        {a.done}/{a.students}
                      </b>
                    </div>
                    <Link className="btn small secondary" to={`/teacher/activities/${a.id}`}>
                      Open
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Async>
      {creating && (
        <NewActivity
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            state.reload()
          }}
        />
      )}
    </>
  )
}
