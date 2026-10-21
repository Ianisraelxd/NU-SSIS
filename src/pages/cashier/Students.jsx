import { useState } from 'react'
import ReceiptModal from '../../components/ReceiptModal.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, Stat, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime, fmtShort, peso } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Check']

// The Cashier cannot change what a student owes or cancel a receipt. They send a request with a reason; an
// Administrator decides. One dialog serves both kinds of request.
function RequestDialog({ title, intro, confirmLabel, fields, path, body, onClose, onDone }) {
  const toast = useToast()
  const [values, setValues] = useState(fields.reduce((o, f) => ({ ...o, [f.key]: f.value ?? '' }), {}))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      await api.post(path, { ...body, ...values })
      toast('Request sent to the Administrator for approval.')
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={send}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 12 }}>{intro}</p>
      <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
        Nothing changes until an Administrator approves the request.
      </p>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} htmlFor={`rq-${f.key}`} error={f.key === 'reason' ? error : undefined}>
          <input
            id={`rq-${f.key}`}
            className="input"
            type={f.type ?? 'text'}
            min={f.type === 'number' ? 1 : undefined}
            step={f.type === 'number' ? '0.01' : undefined}
            maxLength={f.key === 'reason' ? 300 : 60}
            value={values[f.key]}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
          />
        </Field>
      ))}
    </Modal>
  )
}

function Manage({ id, onClose, onChanged }) {
  const state = useApi(`/cashier/students/${id}`)
  const toast = useToast()
  const [pay, setPay] = useState({ amount: '', method: 'Cash' })
  const [receipt, setReceipt] = useState(null)
  const [dialog, setDialog] = useState(null)
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
    const res = await run(() => api.post(`/cashier/students/${id}/payments`, { amount: pay.amount || d.balance, method: pay.method }), { text: 'Payment recorded.', confetti: true }, e)
    if (res) {
      setPay({ amount: '', method: 'Cash' })
      const fresh = await api.get(`/cashier/students/${id}`)
      const paid = fresh.payments.find((p) => p.reference === res.orNumber)
      if (paid) setReceipt({ kind: 'payment', id: paid.id })
    }
  }

  const done = () => {
    setDialog(null)
    refresh()
  }

  return (
    <Modal title={state.data ? `${state.data.student.name} · ${state.data.student.studentNo}` : 'Student account'} wide onClose={onClose}>
      <Async state={state}>
        {(d) => {
          const waiting = (kind, targetId) => d.changeRequests.some((c) => c.status === 'Pending' && c.kind.startsWith(kind) && c.targetId === targetId)
          return (
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

              <Card title="Fees assessed" sub="Fee changes need the Administrator’s approval" flush>
                <Table
                  empty="No fees assessed."
                  columns={[
                    { key: 'name', label: 'Fee name' },
                    { key: 'amount', label: 'Amount', align: 'num', render: (f) => peso(f.amount) },
                    {
                      key: 'x',
                      label: 'Request a change',
                      render: (f) =>
                        waiting('fee', f.id) ? (
                          <Badge status="Pending">Waiting for approval</Badge>
                        ) : (
                          <div className="actions">
                            <button className="btn small secondary" onClick={() => setDialog({ type: 'fee-change', fee: f })}>
                              Ask to change
                            </button>
                            <button className="btn small danger" onClick={() => setDialog({ type: 'fee-remove', fee: f })}>
                              Ask to remove
                            </button>
                          </div>
                        ),
                    },
                  ]}
                  rows={d.fees}
                />
                <div style={{ padding: 16 }}>
                  <button className="btn small secondary" onClick={() => setDialog({ type: 'fee-add' })}>
                    Ask to add a fee
                  </button>
                </div>
              </Card>

              <Card title="Record a payment" sub={d.balance > 0 ? `The student owes ${peso(d.balance)}` : 'Nothing is owed'}>
                <form onSubmit={(e) => record(e, d)} noValidate>
                  <div className="row">
                    <Field label="Amount received (₱)" htmlFor="pay-amt">
                      <input id="pay-amt" className="input" type="number" min="1" step="0.01" placeholder={String(d.balance)} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                    </Field>
                    <Field label="Payment method" htmlFor="pay-method" help="The official receipt number is generated by the system">
                      <select id="pay-method" className="select" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                        {METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <button className="btn" disabled={busy || d.balance <= 0}>
                    Record payment & issue receipt
                  </button>
                </form>
              </Card>

              <Card title="Payment history" sub="A receipt cannot be edited. To cancel one, ask the Administrator to void it." flush>
                <Table
                  empty="No payments yet."
                  columns={[
                    { key: 'paidAt', label: 'Date and time paid', render: (p) => (p.paidAt ? fmtDateTime(p.paidAt) : `due ${fmtShort(p.dueOn)}`) },
                    { key: 'reference', label: 'Official receipt no. and cashier', render: (p) => (p.reference ? <span><b>{p.reference}</b><br /><span className="muted">received by {p.recordedBy ?? '—'}</span></span> : '—') },
                    { key: 'method', label: 'Payment method', render: (p) => p.method ?? '—' },
                    { key: 'amount', label: 'Amount', align: 'num', render: (p) => peso(p.amount) },
                    { key: 'status', label: 'Status', render: (p) => <Badge status={p.status} /> },
                    {
                      key: 'x',
                      label: 'Actions',
                      render: (p) =>
                        p.status === 'Paid' ? (
                          <div className="actions">
                            <button className="btn small secondary" onClick={() => setReceipt({ kind: 'payment', id: p.id })}>
                              View receipt
                            </button>
                            {waiting('payment', p.id) ? (
                              <Badge status="Pending">Void requested</Badge>
                            ) : (
                              <button className="btn small danger" onClick={() => setDialog({ type: 'void', payment: p })}>
                                Ask to void
                              </button>
                            )}
                          </div>
                        ) : p.status === 'Void' ? (
                          <span className="muted">Voided: {p.voidReason}</span>
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
                      { key: 'requestNo', label: 'Request no.' },
                      { key: 'document', label: 'Document' },
                      { key: 'orNumber', label: 'Official receipt no.' },
                      { key: 'amount', label: 'Amount', align: 'num', render: (p) => peso(p.amount) },
                      {
                        key: 'x',
                        label: 'Actions',
                        render: (p) => (
                          <button className="btn small secondary" onClick={() => setReceipt({ kind: 'request', id: p.id })}>
                            View receipt
                          </button>
                        ),
                      },
                    ]}
                    rows={d.documentPayments}
                  />
                </Card>
              )}

              {d.changeRequests.length > 0 && (
                <Card title="Requests sent to the Administrator" sub="For this student" flush>
                  <Table
                    columns={[
                      { key: 'requestedAt', label: 'Date and time requested', render: (c) => fmtDateTime(c.requestedAt) },
                      { key: 'summary', label: 'What was asked' },
                      { key: 'reason', label: 'Reason given' },
                      { key: 'status', label: 'Decision', render: (c) => <Badge status={c.status} /> },
                      { key: 'decisionNote', label: 'Administrator’s note', render: (c) => c.decisionNote ?? '—' },
                    ]}
                    rows={d.changeRequests}
                  />
                </Card>
              )}
            </div>
          )
        }}
      </Async>
      {receipt && <ReceiptModal kind={receipt.kind} id={receipt.id} onClose={() => setReceipt(null)} />}
      {dialog?.type === 'void' && (
        <RequestDialog
          title={`Ask to void ${dialog.payment.reference}`}
          intro={`If approved, the ${peso(dialog.payment.amount)} payment is cancelled and the student’s balance goes back up.`}
          confirmLabel="Send void request"
          path={`/cashier/payments/${dialog.payment.id}/void-request`}
          fields={[{ key: 'reason', label: 'Why should this receipt be voided?' }]}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === 'fee-add' && (
        <RequestDialog
          title="Ask to add a fee"
          intro="Describe the fee that should be added to this student’s assessment."
          confirmLabel="Send request"
          path={`/cashier/students/${id}/fee-requests`}
          body={{ action: 'add' }}
          fields={[
            { key: 'name', label: 'Fee name (for example ID replacement)' },
            { key: 'amount', label: 'Amount (₱)', type: 'number' },
            { key: 'reason', label: 'Why is this fee needed?' },
          ]}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === 'fee-change' && (
        <RequestDialog
          title={`Ask to change “${dialog.fee.name}”`}
          intro={`Currently ${peso(dialog.fee.amount)}. Enter the corrected name and amount.`}
          confirmLabel="Send request"
          path={`/cashier/students/${id}/fee-requests`}
          body={{ action: 'update', feeId: dialog.fee.id }}
          fields={[
            { key: 'name', label: 'Fee name', value: dialog.fee.name },
            { key: 'amount', label: 'New amount (₱)', type: 'number', value: dialog.fee.amount },
            { key: 'reason', label: 'Why does it need to change?' },
          ]}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.type === 'fee-remove' && (
        <RequestDialog
          title={`Ask to remove “${dialog.fee.name}”`}
          intro={`If approved, ${peso(dialog.fee.amount)} is taken off this student’s assessment.`}
          confirmLabel="Send request"
          path={`/cashier/students/${id}/fee-requests`}
          body={{ action: 'delete', feeId: dialog.fee.id }}
          fields={[{ key: 'reason', label: 'Why should this fee be removed?' }]}
          onClose={() => setDialog(null)}
          onDone={done}
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
      <PageHead title="Students & Balances" subtitle="View assessments, record payments and confirm enrollment payment. Fee changes and receipt voids go to the Administrator for approval." />
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
                  { key: 'studentNo', label: 'Student number', render: (s) => <span className="mono">{s.studentNo}</span> },
                  { key: 'name', label: 'Student name', render: (s) => <b>{s.name}</b> },
                  { key: 'assessed', label: 'Total assessed', align: 'num', render: (s) => peso(s.assessed) },
                  { key: 'paid', label: 'Amount paid', align: 'num', render: (s) => `${peso(s.paid)} (${s.percent}%)` },
                  { key: 'balance', label: 'Remaining balance', align: 'num', render: (s) => peso(s.balance) },
                  { key: 'enrollmentStatus', label: 'Enrollment status', render: (s) => (s.enrollmentStep === 3 ? <Badge status="Pending">Confirm payment</Badge> : <Badge status={s.enrollmentStatus} />) },
                  {
                    key: 'x',
                    label: 'Account',
                    render: (s) => (
                      <button className="btn small secondary" onClick={() => setOpen(s.id)}>
                        Open account
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
