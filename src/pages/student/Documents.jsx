import { useState } from 'react'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime, fmtShort, peso, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const PURPOSES = ['Employment', 'Scholarship', 'Transfer', 'Further studies', 'Personal use', 'Others']
const todayStr = () => new Date().toLocaleDateString('en-CA')

const NEXT_HINT = {
  Pending: 'Waiting for the Registrar to review your request.',
  'For Payment': 'Approved. Pay the fee at the Cashier so processing can start.',
  Processing: 'The Registrar is preparing your document.',
  'Ready for Release': 'Ready! Claim it at the Registrar’s Office with a valid school ID.',
  Released: 'Released to you.',
  Cancelled: 'This request was cancelled.',
}

function Details({ request, onClose }) {
  return (
    <Modal title={`${request.requestNo} · ${request.document}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="stack" style={{ gap: 18 }}>
        <p>
          <Badge status={request.status} /> <span className="muted">{NEXT_HINT[request.status]}</span>
        </p>
        <dl className="kv">
          <dt>Copies</dt>
          <dd>{request.copies}</dd>
          <dt>Fee</dt>
          <dd>{request.totalFee > 0 ? peso(request.totalFee) : 'Free'}</dd>
          <dt>Pickup date</dt>
          <dd>{request.pickupDate}</dd>
          {request.purpose && (
            <>
              <dt>Purpose</dt>
              <dd>{request.purpose}</dd>
            </>
          )}
          {request.orNumber && (
            <>
              <dt>Official receipt</dt>
              <dd>
                {request.orNumber} · paid {fmtDateTime(request.paidAt)}
              </dd>
            </>
          )}
        </dl>
        <div>
          <h3 className="mini-title" style={{ marginTop: 0 }}>
            Request history
          </h3>
          <ol className="timeline">
            {request.history.map((h, i) => (
              <li key={i}>
                <b>{h.status}</b> <span className="muted">— {h.note}</span>
                <time>{fmtDateTime(h.createdAt)}</time>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}

export default function Documents() {
  const state = useApi('/student/documents')
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState({ docTypeId: '', purpose: PURPOSES[0], copies: 1, pickupDate: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e, docTypeId) => {
    e.preventDefault()
    const button = e.currentTarget.querySelector('button.btn')
    setError('')
    if (!form.pickupDate) return setError('Choose a pickup date.')
    setBusy(true)
    try {
      const res = await api.post('/student/documents/requests', { ...form, docTypeId, copies: Number(form.copies) })
      burst(button)
      toast(`Request ${res.requestNo} submitted.`)
      setForm((f) => ({ ...f, remarks: '', pickupDate: '' }))
      state.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (r) => {
    const ok = await confirm({ title: 'Cancel this request?', message: `${r.requestNo} (${r.document}) will be cancelled.`, confirmLabel: 'Cancel request' })
    if (!ok) return
    try {
      await api.post(`/student/documents/requests/${r.id}/cancel`)
      toast('Request cancelled.')
      state.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {(d) => {
        const selectedId = Number(form.docTypeId || d.types.find((t) => !t.requiresClearance || d.clearance.complete)?.id)
        const type = d.types.find((t) => t.id === selectedId)
        const total = (type?.fee ?? 0) * (Number(form.copies) || 0)
        return (
          <>
            <PageHead title="Documents and Forms" subtitle={subtitle(d.yearLevel, d.term)} />
            <div className="stack">
              {d.clearance.complete ? (
                <div className="alert ok">
                  <div>
                    <strong>E-Clearance: Complete.</strong> You can request any document.
                  </div>
                </div>
              ) : (
                <div className="alert warn">
                  <div>
                    <strong>
                      E-Clearance: Incomplete ({d.clearance.cleared} of {d.clearance.total} cleared).
                    </strong>{' '}
                    Documents marked “needs clearance” are locked until every office clears you.
                  </div>
                </div>
              )}

              <div className="grid form-split">
                <Card title="Request a document">
                  <form onSubmit={(e) => submit(e, selectedId)} noValidate>
                    <Field label="Document type" htmlFor="doc-type">
                      <select id="doc-type" className="select" value={selectedId || ''} onChange={set('docTypeId')}>
                        {d.types.map((t) => {
                          const locked = t.requiresClearance && !d.clearance.complete
                          return (
                            <option key={t.id} value={t.id} disabled={locked}>
                              {t.name} — {peso(t.fee)}
                              {locked ? ' (needs clearance)' : ''}
                            </option>
                          )
                        })}
                      </select>
                    </Field>
                    {type && (
                      <div className="alert info" style={{ marginBottom: 16 }}>
                        <div>
                          <strong>Requirements:</strong> {type.requirements || 'None.'}
                          <br />
                          <strong>Fee:</strong> {type.fee > 0 ? `${peso(type.fee)} per copy` : 'Free'}
                        </div>
                      </div>
                    )}
                    <Field label="Purpose" htmlFor="purpose">
                      <select id="purpose" className="select" value={form.purpose} onChange={set('purpose')}>
                        {PURPOSES.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </Field>
                    <div className="row">
                      <Field label="Copies" htmlFor="copies">
                        <select id="copies" className="select" value={form.copies} onChange={set('copies')}>
                          {Array.from({ length: d.maxCopies }, (_, i) => i + 1).map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Pickup date" htmlFor="pickup">
                        <input id="pickup" type="date" className="input" min={todayStr()} value={form.pickupDate} onChange={set('pickupDate')} />
                      </Field>
                    </div>
                    <Field label="Remarks (optional)" htmlFor="remarks">
                      <textarea id="remarks" className="textarea" maxLength={500} value={form.remarks} onChange={set('remarks')} />
                    </Field>
                    <div className="switch" style={{ borderBottom: 0, padding: '4px 0 14px' }}>
                      <b>Total fee</b>
                      <b>{peso(total)}</b>
                    </div>
                    {error && (
                      <p className="error-text" role="alert" style={{ marginBottom: 12, color: 'var(--bad)', fontWeight: 600 }}>
                        {error}
                      </p>
                    )}
                    <button className="btn block" disabled={busy || !type}>
                      {busy ? 'Submitting…' : 'Submit request'}
                    </button>
                    <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                      After the Registrar approves, pay the fee at the Cashier. You’ll be notified at every step.
                    </p>
                  </form>
                </Card>

                <Card title="My requests (tracking)" flush>
                  <Table
                    empty="You haven’t requested any documents yet."
                    columns={[
                      { key: 'requestNo', label: 'Request number', render: (r) => <span className="mono">{r.requestNo}</span> },
                      { key: 'document', label: 'Document', render: (r) => (r.copies > 1 ? `${r.document} ×${r.copies}` : r.document) },
                      { key: 'createdAt', label: 'Date filed', render: (r) => fmtShort(r.createdAt) },
                      { key: 'status', label: 'Request status', render: (r) => <Badge status={r.status} /> },
                      {
                        key: 'actions',
                        label: 'Actions',
                        render: (r) => (
                          <div className="actions">
                            <button className="btn small secondary" onClick={() => setDetails(r)}>
                              Details
                            </button>
                            {['Pending', 'For Payment'].includes(r.status) && (
                              <button className="btn small danger" onClick={() => cancel(r)}>
                                Cancel
                              </button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                    rows={d.requests}
                  />
                </Card>
              </div>
            </div>
            {details && <Details request={d.requests.find((r) => r.id === details.id) ?? details} onClose={() => setDetails(null)} />}
          </>
        )
      }}
    </Async>
  )
}
