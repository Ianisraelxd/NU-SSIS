import { useState } from 'react'
import ReceiptModal from '../../components/ReceiptModal.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime, peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function Verify({ request, onClose, onDone }) {
  const toast = useToast()
  const [orNumber, setOrNumber] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const verify = async (e) => {
    setBusy(true)
    const target = e.currentTarget
    try {
      const res = await api.post(`/cashier/requests/${request.id}/verify`, { amount: request.totalFee, orNumber })
      burst(target, 18)
      toast(`${request.requestNo} paid — receipt ${res.orNumber}.`)
      onDone(res)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Verify payment · ${request.requestNo}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={verify}>
            Verify {peso(request.totalFee)} received
          </button>
        </>
      }
    >
      <dl className="kv" style={{ marginBottom: 16 }}>
        <dt>Student</dt>
        <dd>
          {request.studentName} ({request.studentNo})
        </dd>
        <dt>Document</dt>
        <dd>
          {request.document}
          {request.copies > 1 ? ` × ${request.copies}` : ''}
        </dd>
        <dt>Amount due</dt>
        <dd>{peso(request.totalFee)}</dd>
      </dl>
      <Field label="OR number" htmlFor="v-or" help="Leave blank to generate the next official receipt number" error={error}>
        <input id="v-or" className="input" value={orNumber} onChange={(e) => setOrNumber(e.target.value)} />
      </Field>
    </Modal>
  )
}

export default function CashierDocuments() {
  const [tab, setTab] = useState('awaiting')
  const state = useApi(`/cashier/requests?status=${tab === 'paid' ? 'paid' : 'awaiting'}`)
  const [verifying, setVerifying] = useState(null)
  const [receipt, setReceipt] = useState(null)

  return (
    <>
      <PageHead title="Document Payments" subtitle="Verify the fee for documents the Registrar approved, so processing can start." />
      <div className="stack">
        <div className="pipeline" role="group" aria-label="View">
          <button aria-pressed={tab === 'awaiting'} onClick={() => setTab('awaiting')}>
            Waiting for payment
          </button>
          <button aria-pressed={tab === 'paid'} onClick={() => setTab('paid')}>
            Paid
          </button>
        </div>
        <Async state={state}>
          {({ requests }) => (
            <Card flush title={`${requests.length} request${requests.length === 1 ? '' : 's'}`}>
              <Table
                empty={tab === 'awaiting' ? 'Nothing is waiting for payment. 🎉' : 'No document payments yet.'}
                columns={[
                  { key: 'requestNo', label: 'Request', render: (r) => <span className="mono">{r.requestNo}</span> },
                  {
                    key: 'student',
                    label: 'Student',
                    render: (r) => (
                      <>
                        <b>{r.studentName}</b>
                        <br />
                        <span className="muted">{r.studentNo}</span>
                      </>
                    ),
                  },
                  { key: 'document', label: 'Document', render: (r) => `${r.document}${r.copies > 1 ? ` ×${r.copies}` : ''}` },
                  { key: 'totalFee', label: 'Fee', align: 'num', render: (r) => peso(r.totalFee) },
                  tab === 'paid' ? { key: 'orNumber', label: 'OR number', render: (r) => `${r.orNumber} · ${fmtDateTime(r.paidAt)}` } : { key: 'createdAt', label: 'Filed', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                  {
                    key: 'x',
                    label: '',
                    render: (r) =>
                      tab === 'awaiting' ? (
                        <button className="btn small" onClick={() => setVerifying(r)}>
                          Verify payment
                        </button>
                      ) : (
                        <button className="btn small secondary" onClick={() => setReceipt(r.id)}>
                          Receipt
                        </button>
                      ),
                  },
                ]}
                rows={requests}
              />
            </Card>
          )}
        </Async>
      </div>
      {verifying && (
        <Verify
          request={verifying}
          onClose={() => setVerifying(null)}
          onDone={(res) => {
            setVerifying(null)
            state.reload()
            setReceipt(res.id)
          }}
        />
      )}
      {receipt && <ReceiptModal kind="request" id={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}
