import { useState } from 'react'
import { api } from '../lib/api.js'
import { burst } from '../lib/fx.js'
import { fmtDateTime, timeAgo } from '../lib/format.js'
import { useApi, usePolling } from '../lib/hooks.js'
import { Async, Badge, Card, PageHead, Stat, useConfirm, useToast } from './ui.jsx'

const counterKey = 'nu-ssis-counter'
const readCounter = () => {
  try {
    return localStorage.getItem(counterKey) || 'Counter 1'
  } catch {
    return 'Counter 1'
  }
}

// Queue Management for Registrar, Cashier and Department staff: call next, finish, skip.
export default function StaffQueue() {
  const state = useApi('/queue/staff')
  const toast = useToast()
  const confirm = useConfirm()
  const [counter, setCounter] = useState(readCounter)
  const [busy, setBusy] = useState(false)

  usePolling(state.reload, 6000)

  const act = async (fn, okMessage, event) => {
    const target = event?.currentTarget
    setBusy(true)
    try {
      const res = await fn()
      if (okMessage) toast(typeof okMessage === 'function' ? okMessage(res) : okMessage)
      if (target && okMessage === 'Done') burst(target, 14)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveCounter = (value) => {
    setCounter(value)
    try {
      localStorage.setItem(counterKey, value)
    } catch {
      /* ignore */
    }
  }

  const skip = async (t) => {
    const ok = await confirm({
      title: `Skip ${t.number}?`,
      message: `${t.studentName} will be told they were not at the counter and can take a new number.`,
      confirmLabel: 'Skip ticket',
      cancelLabel: 'Keep serving',
    })
    if (ok) act(() => api.post(`/queue/staff/${t.id}/skip`), `${t.number} skipped`)
  }

  return (
    <Async state={state}>
      {(q) => (
        <>
          <PageHead
            title="Queue Management"
            subtitle={`${q.office}${q.department ? ` · ${q.department.code}` : ''} — students take a number from the Digital Queue page; call them in order.`}
          >
            <div className="toolbar">
              <label className="sr-only" htmlFor="counter">
                Your counter
              </label>
              <input id="counter" className="input counter-input" value={counter} maxLength={30} onChange={(e) => saveCounter(e.target.value)} placeholder="Counter 1" />
              <button className="btn" disabled={busy || q.mine.length > 0 || q.waiting.length === 0} onClick={() => act(() => api.post('/queue/staff/next', { counter }), (r) => `Now serving ${r.ticket.number}`)}>
                Call next ({q.waiting.length} waiting)
              </button>
            </div>
          </PageHead>

          <div className="stack">
            <div className="grid stats">
              <Stat label="Waiting" value={q.stats.waiting} tone={q.stats.waiting ? 'warn' : 'ok'} />
              <Stat label="Served today" value={q.stats.served} tone="ok" />
              <Stat label="Skipped" value={q.stats.skipped} />
              <Stat label="Avg service time" value={`${q.stats.avgMinutes} min`} />
            </div>

            <Card title="Now serving" sub="Finish a ticket before calling the next one">
              {q.mine.length === 0 && <p className="muted">You aren’t serving anyone. Press “Call next”.</p>}
              <div className="board-now">
                {q.mine.map((t) => (
                  <div key={t.id} className="board-ticket">
                    <div className="num">{t.number}</div>
                    <p style={{ marginTop: 8 }}>
                      <b>{t.studentName}</b> <span className="muted">({t.studentNo})</span>
                    </p>
                    <p className="muted">
                      {t.service} · {t.counter}
                    </p>
                    <div className="actions" style={{ marginTop: 14 }}>
                      <button className="btn" disabled={busy} onClick={(e) => act(() => api.post(`/queue/staff/${t.id}/done`), 'Done', e)}>
                        Mark done
                      </button>
                      <button className="btn danger" disabled={busy} onClick={() => skip(t)}>
                        No-show · skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {q.others.length > 0 && (
                <p className="muted" style={{ marginTop: 14 }}>
                  Also being served by colleagues: {q.others.map((t) => `${t.number} (${t.counter})`).join(', ')}
                </p>
              )}
            </Card>

            <Card title="Waiting" sub="First come, first served" actions={<Badge tone="warn">{q.waiting.length}</Badge>}>
              {q.waiting.length === 0 && <p className="muted">Nobody is waiting. 🎉</p>}
              <div className="queue-now">
                {q.waiting.map((t) => (
                  <div className="queue-item" key={t.id}>
                    <div className="lead">
                      <span className="queue-pos" aria-label={`Position ${t.position}`}>
                        {t.position}
                      </span>
                      <div>
                        <div className="title">
                          {t.number} · {t.studentName} <span className="muted">({t.studentNo})</span>
                        </div>
                        <div className="sub">
                          {t.service} · took a number {timeAgo(t.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Recently finished" flush>
              {q.recent.length === 0 && <p className="empty">Nothing finished yet today.</p>}
              {q.recent.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Queue number</th>
                        <th>Student</th>
                        <th>Service requested</th>
                        <th>Date and time taken</th>
                        <th>Final status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.recent.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <b>{t.number}</b>
                          </td>
                          <td>{t.studentName}</td>
                          <td>{t.service}</td>
                          <td>{fmtDateTime(t.createdAt)}</td>
                          <td>
                            <Badge status={t.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
