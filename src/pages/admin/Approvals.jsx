import { useState } from 'react'
import { Async, Badge, Card, Field, Modal, PageHead, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function RejectDialog({ request, onClose, onDone }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const send = async () => {
    try {
      await api.post(`/admin/approvals/${request.id}/decide`, { decision: 'reject', note })
      toast('Request rejected.')
      onDone()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <Modal
      title="Reject this request?"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger-solid" onClick={send}>
            Reject request
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>
        <b>{request.summary}</b> for {request.studentName} will <b>not</b> be applied.
      </p>
      <Field label="Why are you rejecting it? (the Cashier sees this)" htmlFor="rej-note" error={error}>
        <input id="rej-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  )
}

export default function Approvals() {
  const [scope, setScope] = useState('Pending')
  const state = useApi(`/admin/approvals?status=${scope}`)
  const toast = useToast()
  const confirm = useConfirm()
  const [rejecting, setRejecting] = useState(null)

  const approve = async (r, e) => {
    const target = e.currentTarget
    const ok = await confirm({ title: 'Approve this request?', message: `${r.summary} — for ${r.studentName}. It is applied immediately.`, confirmLabel: 'Approve and apply' })
    if (!ok) return
    try {
      await api.post(`/admin/approvals/${r.id}/decide`, { decision: 'approve' })
      burst(target)
      toast('Approved and applied.')
      state.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Approvals" subtitle="Fee changes and receipt voids that a Cashier asked for. A Cashier cannot make these changes alone, so every one is decided here and recorded in the audit log." />
      <div className="stack">
        <div className="pipeline" role="group" aria-label="Show">
          <button aria-pressed={scope === 'Pending'} onClick={() => setScope('Pending')}>
            Waiting for your decision
          </button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            All requests
          </button>
        </div>
        <Async state={state}>
          {({ approvals }) => (
            <div className="stack">
              {approvals.length === 0 && (
                <Card>
                  <p className="empty">Nothing is waiting for approval.</p>
                </Card>
              )}
              {approvals.map((r) => (
                <Card key={r.id}>
                  <div className="card-head">
                    <div>
                      <h2>{r.summary}</h2>
                      <p className="sub">
                        {r.label} · for {r.studentName} ({r.studentNo})
                      </p>
                    </div>
                    <Badge status={r.status} />
                  </div>
                  <dl className="kv">
                    <dt>Requested by</dt>
                    <dd>{r.requestedBy ?? 'a cashier'}</dd>
                    <dt>Date and time requested</dt>
                    <dd>{fmtDateTime(r.requestedAt)}</dd>
                    <dt>Reason given</dt>
                    <dd>{r.reason}</dd>
                    {r.status !== 'Pending' && (
                      <>
                        <dt>Decided by</dt>
                        <dd>
                          {r.decidedBy ?? '—'}, {fmtDateTime(r.decidedAt)}
                        </dd>
                        {r.decisionNote && (
                          <>
                            <dt>Administrator’s note</dt>
                            <dd>{r.decisionNote}</dd>
                          </>
                        )}
                      </>
                    )}
                  </dl>
                  {r.status === 'Pending' && (
                    <div className="actions" style={{ marginTop: 14 }}>
                      <button className="btn" onClick={(e) => approve(r, e)}>
                        Approve
                      </button>
                      <button className="btn danger" onClick={() => setRejecting(r)}>
                        Reject
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Async>
      </div>
      {rejecting && (
        <RejectDialog
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            state.reload()
          }}
        />
      )}
    </>
  )
}
