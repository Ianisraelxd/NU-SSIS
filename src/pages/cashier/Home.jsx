import { Async, Card, Stat } from '../../components/ui.jsx'
import { peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import { Link } from 'react-router-dom'

export default function CashierHome() {
  const o = useApi('/cashier/overview')
  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to the <b>Cashier Module</b>
        </h1>
        <p>National University Laguna Campus</p>
      </div>

      <Async state={o}>
        {(d) => (
          <>
            <div className="grid stats">
              <Stat label="Collected today" value={peso(d.collectedToday)} tone="ok" hint={`${peso(d.collectedWeek)} this week`} />
              <Stat label="Document fees to verify" to="/cashier/documents" value={d.awaitingDocPayment} tone={d.awaitingDocPayment ? 'warn' : 'ok'} />
              <Stat label="Enrollment payments to confirm" to="/cashier/students" value={d.awaitingEnrollment} tone={d.awaitingEnrollment ? 'warn' : 'ok'} />
              <Stat label="Students with a balance" to="/cashier/students" value={d.withBalance} />
              <Stat label="Waiting in queue" to="/cashier/queue" value={d.queueWaiting} hint="Cashier window today" />
            </div>
            <Card title="What you can do here">
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                <li>
                  <Link to="/cashier/students">Students &amp; balances</Link> — view assessments, adjust fees, record payments with an official receipt, and confirm enrollment payment.
                </li>
                <li>
                  <Link to="/cashier/documents">Document payments</Link> — verify the fee for documents the Registrar approved so processing can start.
                </li>
                <li>
                  <Link to="/cashier/queue">Queue Management</Link> — call the next student in line.
                </li>
                <li>
                  <Link to="/cashier/reports">Reports</Link> — collection reports you can print or export.
                </li>
              </ul>
            </Card>
          </>
        )}
      </Async>
    </div>
  )
}
