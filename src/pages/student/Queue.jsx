import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime } from '../../lib/format.js'
import { useApi, usePolling } from '../../lib/hooks.js'

// Digital queue: take a number, watch your position, get notified when you are called.
export default function Queue() {
  const mine = useApi('/queue/mine')
  const offices = useApi('/queue/offices')
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    mine.reload()
    offices.reload()
  }
  usePolling(refresh, 8000)

  const join = async (office, service, event) => {
    const target = event.currentTarget
    setBusy(true)
    try {
      const { ticket } = await api.post('/queue/tickets', { office, service })
      burst(target, 18)
      toast(`You are ${ticket.number} at the ${office}.`)
      refresh()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (t) => {
    const ok = await confirm({ title: `Give up ${t.number}?`, message: 'You will lose your place in line. You can take a new number afterwards.', confirmLabel: 'Cancel my number', cancelLabel: 'Keep my place' })
    if (!ok) return
    try {
      await api.delete(`/queue/tickets/${t.id}`)
      toast('Ticket cancelled.')
      refresh()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Digital Queue" subtitle="Skip the line: take a number, then come when it’s close to your turn." />
      <div className="stack">
        <Async state={mine}>
          {({ ticket, history }) => (
            <>
              {ticket ? (
                <div className={`ticket-card ${ticket.status === 'Serving' ? 'serving' : ''}`} aria-live="polite">
                  <div>
                    <div className="ticket-number">{ticket.number}</div>
                    <Badge status={ticket.status} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 22 }}>
                      {ticket.office} · {ticket.service}
                    </h2>
                    {ticket.status === 'Serving' ? (
                      <p style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>🔔 It’s your turn — please go to {ticket.counter ?? 'the counter'} now.</p>
                    ) : (
                      <div className="ticket-facts">
                        <div>
                          <b>{ticket.position}</b>
                          <span>Your position</span>
                        </div>
                        <div>
                          <b>{ticket.ahead}</b>
                          <span>Ahead of you</span>
                        </div>
                        <div>
                          <b>~{ticket.estMinutes} min</b>
                          <span>Estimated wait</span>
                        </div>
                        <div>
                          <b>{ticket.nowServing.length ? ticket.nowServing.map((n) => n.number).join(', ') : '—'}</b>
                          <span>Now serving</span>
                        </div>
                      </div>
                    )}
                    {ticket.status === 'Waiting' && (
                      <button className="btn danger small" style={{ marginTop: 16 }} onClick={() => cancel(ticket)}>
                        Cancel my number
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="alert info">
                  <div>
                    <strong>You have no active number.</strong> Choose an office and a service below to get one. We’ll notify you when you’re called.
                  </div>
                </div>
              )}

              <Async state={offices}>
                {({ offices: list }) => (
                  <div className="grid stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    {list.map((o) => (
                      <Card key={o.office} className="office-card">
                        <h3>{o.label}</h3>
                        <p className="muted" style={{ marginTop: 2 }}>
                          {o.waiting} waiting · about {o.avgMinutes} min per person
                        </p>
                        <div className="serving-now" aria-label="Now serving">
                          {o.nowServing.length === 0 && <span className="muted">Nobody is being served right now</span>}
                          {o.nowServing.map((n) => (
                            <span key={n.number} className="chip">
                              Now serving {n.number}
                              {n.counter ? ` · ${n.counter}` : ''}
                            </span>
                          ))}
                        </div>
                        {o.unavailable ? (
                          <p className="muted">{o.unavailable}</p>
                        ) : (
                          <div className="service-buttons">
                            {o.services.map((s) => (
                              <button key={s} className="btn small secondary" disabled={busy || !!ticket} onClick={(e) => join(o.office, s, e)}>
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </Async>

              <Card title="My recent tickets" flush>
                <Table
                  empty="You haven’t used the queue yet."
                  columns={[
                    { key: 'number', label: 'Queue number', render: (t) => <b>{t.number}</b> },
                    { key: 'office', label: 'Office' },
                    { key: 'service', label: 'Service requested' },
                    { key: 'createdAt', label: 'Date and time taken', render: (t) => fmtDateTime(t.createdAt) },
                    { key: 'status', label: 'Final status', render: (t) => <Badge status={t.status} /> },
                  ]}
                  rows={history}
                />
              </Card>
            </>
          )}
        </Async>
      </div>
    </>
  )
}
