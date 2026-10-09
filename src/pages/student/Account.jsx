import { Async, Badge, Card, PageHead, Stat, Table } from '../../components/ui.jsx'
import { fmtDate, fmtShort, peso, subtitle } from '../../lib/format.js'
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
                  { key: 'reference', label: 'Reference', render: (r) => r.reference ?? '—' },
                  { key: 'amount', label: 'Amount', align: 'num', render: (r) => peso(r.amount) },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                ]}
                rows={d.payments}
              />
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
