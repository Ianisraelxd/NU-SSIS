import { useState } from 'react'
import ReceiptModal from '../../components/ReceiptModal.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, Stat, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime, fmtShort, peso } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Check']

function VoidDialog({ payment, onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const send = async () => {
    try {
      await api.post(`/cashier/payments/${payment.id}/void`, { reason })
      toast(`${payment.reference} voided.`)
      onDone()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <Modal
      title={`Void ${payment.reference}?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Keep it
          </button>
          <button className="btn danger-solid" onClick={send}>
            Void receipt
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>
        The {peso(payment.amount)} payment will be cancelled and the student’s balance goes back up.
      </p>
      <Field label="Reason" htmlFor="void-reason" error={error}>
        <input id="void-reason" className="input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  )
}

function Manage({ id, onClose, onChanged }) {
  const state = useApi(`/cashier/students/${id}`)
  const toast = useToast()
  const confirm = useConfirm()
  const [pay, setPay] = useState({ amount: '', method: 'Cash', orNumber: '' })
  const [fee, setFee] = useState({ name: '', amount: '' })
  const [editFee, setEditFee] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [voiding, setVoiding] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    state.reload()
    onChanged()
  }
  const run = async (fn, ok, event) => {
    const target = event?.currentTarget
    setBusy(true)
    try {
      const res = await fn()
      if (target && ok?.confetti) burst(target, 18)
      toast(ok?.text ?? ok)
      refresh()
      return res
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const record = async (e, d) => {
    e.preventDefault()
    const res = await run(() => api.post(`/cashier/students/${id}/payments`, { amount: pay.amount || d.balance, method: pay.method, orNumber: pay.orNumber }), { text: 'Payment recorded.', confetti: true }, e)
    if (res) {
      setPay({ amount: '', method: 'Cash', orNumber: '' })
      const fresh = await api.get(`/cashier/students/${id}`)
      const paid = fresh.payments.find((p) => p.reference === res.orNumber)
      if (paid) setReceipt({ kind: 'payment', id: paid.id })
    }
  }

  const removeFee = async (f) => {
    const ok = await confirm({ title: `Remove “${f.name}”?`, message: `${peso(f.amount)} will be taken off this student’s assessment.`, confirmLabel: 'Remove fee' })
    if (ok) run(() => api.delete(`/cashier/fees/${f.id}`), 'Fee removed.')
  }

  return (
    <Modal title={state.data ? `${state.data.student.name} · ${state.data.student.studentNo}` : 'Student account'} wide onClose={onClose}>
      <Async state={state}>
        {(d) => (
          <div className="stack" style={{ gap: 24 }}>
            <div className="grid stats">
              <Stat label="Assessment" value={peso(d.assessed)} />
              <Stat label="Paid" value={peso(d.paid)} tone="ok" hint={`${d.percent}% of assessment`} />
              <Stat label="Balance" value={peso(d.balance)} tone={d.balance ? 'warn' : 'ok'} />
            </div>

            <Card title="Enrollment payment" sub={`Status: ${d.enrollment.status} · next step: ${d.enrollment.stepName}`}>
              {d.enrollment.confirmed ? (
                <Badge status="Enrolled">Payment confirmed — officially enrolled</Badge>
              ) : d.enrollment.awaitingPayment ? (
                <div className="toolbar">
                  <span>
                    Paid <b>{d.percent}%</b> — at least <b>{d.enrollment.minPercent}%</b> is needed.
                  </span>
                  <button className="btn" disabled={busy || d.percent < d.enrollment.minPercent} onClick={(e) => run(() => api.post(`/cashier/students/${id}/enrollment/confirm`), { text: 'Enrollment payment confirmed.', confetti: true }, e)}>
                    Confirm enrollment payment
                  </button>
                </div>
              ) : (
                <p className="muted">Not ready for payment confirmation — the Registrar has not approved this student’s enrollment yet.</p>
              )}
            </Card>

            <Card title="Fees" sub="Add or adjust what this student is assessed" flush>
              <Table
                empty="No fees assessed."
                columns={[
                  { key: 'name', label: 'Fee' },
                  { key: 'amount', label: 'Amount', align: 'num', render: (f) => peso(f.amount) },
                  {
                    key: 'x',
                    label: '',
                    render: (f) => (
                      <div className="actions">
                        <button className="btn small secondary" onClick={() => setEditFee({ id: f.id, name: f.name, amount: f.amount })}>
                          Edit
                        </button>
                        <button className="btn small danger" onClick={() => removeFee(f)}>
                          Remove
                        </button>
                      </div>
                    ),
                  },
                ]}
                rows={d.fees}
              />
              <form
                className="toolbar"
                style={{ padding: 16 }}
                onSubmit={async (e) => {
                  e.preventDefault()
                  const res = await run(() => (editFee ? api.put(`/cashier/fees/${editFee.id}`, editFee) : api.post(`/cashier/students/${id}/fees`, fee)), editFee ? 'Fee updated.' : 'Fee added.')
                  if (res !== undefined) {
                    setEditFee(null)
                    setFee({ name: '', amount: '' })
                  }
                }}
              >
                <input className="input grow" aria-label="Fee name" placeholder="Fee name (e.g. ID replacement)" value={editFee ? editFee.name : fee.name} onChange={(e) => (editFee ? setEditFee({ ...editFee, name: e.target.value }) : setFee({ ...fee, name: e.target.value }))} />
                <input className="input" type="number" min="1" step="0.01" aria-label="Fee amount" placeholder="Amount ₱" value={editFee ? editFee.amount : fee.amount} onChange={(e) => (editFee ? setEditFee({ ...editFee, amount: e.target.value }) : setFee({ ...fee, amount: e.target.value }))} style={{ width: 150 }} />
                <button className="btn small">{editFee ? 'Save fee' : 'Add fee'}</button>
                {editFee && (
                  <button type="button" className="btn small secondary" onClick={() => setEditFee(null)}>
                    Cancel
                  </button>
                )}
              </form>
            </Card>

            <Card title="Record a payment" sub={d.balance > 0 ? `The student owes ${peso(d.balance)}` : 'Nothing is owed'}>
              <form onSubmit={(e) => record(e, d)} noValidate>
                <div className="row">
                  <Field label="Amount received (₱)" htmlFor="pay-amt">
                    <input id="pay-amt" className="input" type="number" min="1" step="0.01" placeholder={String(d.balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                  </Field>
                  <Field label="Method" htmlFor="pay-method">
                    <select id="pay-method" className="select" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                      {METHODS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="OR number" htmlFor="pay-or" help="Leave blank to generate the next one">
                    <input id="pay-or" className="input" value={pay.orNumber} onChange={(e) => setPay({ ...pay, orNumber: e.target.value })} />
                  </Field>
                </div>
                <button className="btn" disabled={busy || d.balance <= 0}>
                  Record payment & issue receipt
                </button>
              </form>
            </Card>

            <Card title="Payment history" flush>
              <Table
                empty="No payments yet."
                columns={[
                  { key: 'paidAt', label: 'Date', render: (p) => (p.paidAt ? fmtDateTime(p.paidAt) : `due ${fmtShort(p.dueOn)}`) },
                  { key: 'reference', label: 'OR number', render: (p) => p.reference ?? '—' },
                  { key: 'method', label: 'Method', render: (p) => p.method ?? '—' },
                  { key: 'amount', label: 'Amount', align: 'num', render: (p) => peso(p.amount) },
                  { key: 'status', label: 'Status', render: (p) => <Badge status={p.status} /> },
                  {
                    key: 'x',
                    label: '',
                    render: (p) =>
                      p.status === 'Paid' ? (
                        <div className="actions">
                          <button className="btn small secondary" onClick={() => setReceipt({ kind: 'payment', id: p.id })}>
                            Receipt
                          </button>
                          <button className="btn small danger" onClick={() => setVoiding(p)}>
                            Void
                          </button>
                        </div>
                      ) : p.status === 'Void' ? (
                        <span className="muted">{p.voidReason}</span>
                      ) : null,
                  },
                ]}
                rows={d.payments}
              />
            </Card>

            {d.documentPayments.length > 0 && (
              <Card title="Document fee payments" flush>
                <Table
                  columns={[
                    { key: 'requestNo', label: 'Request' },
                    { key: 'document', label: 'Document' },
                    { key: 'orNumber', label: 'OR number' },
                    { key: 'amount', label: 'Amount', align: 'num', render: (p) => peso(p.amount) },
                    {
                      key: 'x',
                      label: '',
                      render: (p) => (
                        <button className="btn small secondary" onClick={() => setReceipt({ kind: 'request', id: p.id })}>
                          Receipt
                        </button>
                      ),
                    },
                  ]}
                  rows={d.documentPayments}
                />
              </Card>
            )}
          </div>
        )}
      </Async>
      {receipt && <ReceiptModal kind={receipt.kind} id={receipt.id} onClose={() => setReceipt(null)} />}
      {voiding && (
        <VoidDialog
          payment={voiding}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null)
            refresh()
          }}
        />
      )}
    </Modal>
  )
}

export default function CashierStudents() {
  const [filters, setFilters] = useState({ q: '', filter: 'all' })
  const q = useDebounced(filters.q)
  const state = useApi(`/cashier/students?${new URLSearchParams({ q, filter: filters.filter })}`)
  const [open, setOpen] = useState(null)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHead title="Students & Balances" subtitle="View assessments, manage fees, record payments and confirm enrollment payment." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="cs-q">
            Search students
          </label>
          <input id="cs-q" className="input grow" placeholder="Search name or student number" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="cs-f">
            Filter
          </label>
          <select id="cs-f" className="select" value={filters.filter} onChange={set('filter')}>
            <option value="all">All students</option>
            <option value="balance">With a balance</option>
            <option value="confirm">Enrollment payment to confirm</option>
          </select>
        </div>
        <Async state={state}>
          {(d) => (
            <Card flush title={`${d.students.length} student${d.students.length === 1 ? '' : 's'}`} sub={d.term}>
              <Table
                empty="No students match."
                columns={[
                  { key: 'studentNo', label: 'Student no.', render: (s) => <span className="mono">{s.studentNo}</span> },
                  { key: 'name', label: 'Name', render: (s) => <b>{s.name}</b> },
                  { key: 'assessed', label: 'Assessed', align: 'num', render: (s) => peso(s.assessed) },
                  { key: 'paid', label: 'Paid', align: 'num', render: (s) => `${peso(s.paid)} (${s.percent}%)` },
                  { key: 'balance', label: 'Balance', align: 'num', render: (s) => peso(s.balance) },
                  { key: 'enrollmentStatus', label: 'Enrollment', render: (s) => (s.enrollmentStep === 3 ? <Badge status="Pending">Confirm payment</Badge> : <Badge status={s.enrollmentStatus} />) },
                  {
                    key: 'x',
                    label: '',
                    render: (s) => (
                      <button className="btn small secondary" onClick={() => setOpen(s.id)}>
                        Manage
                      </button>
                    ),
                  },
                ]}
                rows={d.students}
              />
            </Card>
          )}
        </Async>
      </div>
      {open && <Manage id={open} onClose={() => setOpen(null)} onChanged={state.reload} />}
    </>
  )
}
