import { Async, Badge, Card, PageHead, Stat, Table } from '../../components/ui.jsx'
import { fmtDate, fmtDateTime, fmtShort, peso, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function Account() {
  const state = useApi('/student/account')
  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="View Balance and Status" subtitle={subtitle(d.yearLevel, d.term)} />
          <div className="stack">
            <div className="grid stats">
              <Stat label="Total assessment" value={peso(d.assessed)} />
              <Stat label="Total paid" value={peso(d.paid)} tone="ok" />
              <Stat label="Remaining balance" value={peso(d.balance)} tone={d.balance ? 'warn' : 'ok'} />
              <Stat label="Next due" value={d.nextDue ? fmtShort(d.nextDue) : 'None'} hint={d.nextDue ? fmtDate(d.nextDue) : undefined} />
            </div>
            <div className={`alert ${d.balance ? 'warn' : 'ok'}`}>
              <div>{d.note}</div>
            </div>
            <Card title="Fee breakdown" flush>
              <Table
                columns={[
                  { key: 'name', label: 'Fee' },
                  { key: 'amount', label: 'Amount', align: 'num', render: (r) => peso(r.amount) },
                ]}
                rows={d.fees}
                footer={
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="num">{peso(d.assessed)}</td>
                    </tr>
                  </tfoot>
                }
              />
            </Card>
            <Card title="Payment history" flush>
              <Table
                columns={[
                  { key: 'dueOn', label: 'Date', render: (r) => fmtShort(r.dueOn) },
                  { key: 'reference', label: 'Official receipt', render: (r) => r.reference ?? '—' },
                  { key: 'method', label: 'Method', render: (r) => r.method ?? '—' },
                  { key: 'amount', label: 'Amount', align: 'num', render: (r) => peso(r.amount) },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                ]}
                rows={d.payments}
              />
            </Card>
            <Card title="Document fee payments" sub="Fees you paid at the Cashier for document requests" flush>
              <Table
                empty="No document payments yet."
                columns={[
                  { key: 'requestNo', label: 'Request', render: (r) => <span className="mono">{r.requestNo}</span> },
                  { key: 'document', label: 'Document' },
                  { key: 'orNumber', label: 'Official receipt' },
                  { key: 'paidAt', label: 'Paid', render: (r) => fmtDateTime(r.paidAt) },
                  { key: 'amount', label: 'Amount', align: 'num', render: (r) => peso(r.amount) },
                ]}
                rows={d.documentPayments}
              />
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
