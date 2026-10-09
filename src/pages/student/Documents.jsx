import { useState } from 'react'
import { Async, Badge, Card, Field, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtShort, peso, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const PURPOSES = ['Employment', 'Scholarship', 'Transfer', 'Further studies', 'Personal use', 'Others']
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Documents() {
  const state = useApi('/student/documents')
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState({ docTypeId: '', purpose: PURPOSES[0], copies: 1, pickupDate: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    const ok = await confirm({
      title: 'Cancel this request?',
      message: `${r.requestNo} (${r.document}) will be cancelled.`,
      confirmLabel: 'Cancel request',
    })
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
                    <strong>E-Clearance: Complete.</strong> You can request documents.
                  </div>
                </div>
              ) : (
                <div className="alert warn">
                  <div>
                    <strong>E-Clearance: Incomplete ({d.clearance.cleared} of {d.clearance.total} cleared).</strong> Documents
                    marked “needs clearance” are locked until every office clears you.
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
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
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
                      Pay the fee at the Cashier when you pick up your document.
                    </p>
                  </form>
                </Card>

                <Card title="My requests (tracking)" flush>
                  <Table
                    empty="You haven’t requested any documents yet."
                    columns={[
                      { key: 'requestNo', label: 'Request no.', render: (r) => <span className="mono">{r.requestNo}</span> },
                      { key: 'document', label: 'Document', render: (r) => (r.copies > 1 ? `${r.document} ×${r.copies}` : r.document) },
                      { key: 'createdAt', label: 'Filed', render: (r) => fmtShort(r.createdAt) },
                      { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                      {
                        key: 'actions',
                        label: '',
                        render: (r) =>
                          r.status === 'Pending' ? (
                            <button className="btn small danger" onClick={() => cancel(r)}>
                              Cancel
                            </button>
                          ) : null,
                      },
                    ]}
                    rows={d.requests}
                  />
                </Card>
              </div>
            </div>
          </>
        )
      }}
    </Async>
  )
}
