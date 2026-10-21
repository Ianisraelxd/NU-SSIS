import { fmtDateTime, peso } from '../lib/format.js'
import { useApi } from '../lib/hooks.js'
import { Async, Modal } from './ui.jsx'

// Official receipt (tuition payment or document fee). `kind` is "payment" or "request".
export default function ReceiptModal({ kind, id, onClose }) {
  const state = useApi(`/cashier/receipts/${kind}/${id}`)
  return (
    <Modal
      title="Official receipt"
      printable
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn" onClick={() => window.print()}>
            Print receipt
          </button>
        </>
      }
    >
      <Async state={state}>
        {(r) => (
          <div className="receipt">
            <h3>{r.school}</h3>
            <p className="sub">Official Receipt</p>
            <dl>
              <dt>Official receipt number</dt>
              <dd>{r.orNumber}</dd>
              <dt>Date</dt>
              <dd>{fmtDateTime(r.paidAt)}</dd>
              <dt>Received from</dt>
              <dd>
                {r.student} ({r.studentNo})
              </dd>
              <dt>For</dt>
              <dd>{r.description}</dd>
              <dt>Method</dt>
              <dd>{r.method}</dd>
              <dt>Cashier</dt>
              <dd>{r.cashier}</dd>
              {r.balanceAfter != null && (
                <>
                  <dt>Balance after</dt>
                  <dd>{peso(r.balanceAfter)}</dd>
                </>
              )}
            </dl>
            <div className="total">
              <span>Amount received</span>
              <span>{peso(r.amount)}</span>
            </div>
          </div>
        )}
      </Async>
    </Modal>
  )
}
