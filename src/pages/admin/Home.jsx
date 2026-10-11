import { Link } from 'react-router-dom'
import { Async, Card, Stat, Table } from '../../components/ui.jsx'
import { ROLE_LABEL, fmtDateTime, peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function AdminHome() {
  const o = useApi('/admin/overview')
  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to the <b>Admin Module</b>
        </h1>
        <p>Student Services Information System · National University Laguna</p>
      </div>
      <Async state={o}>
        {(d) => {
          const accounts = Object.values(d.roles).reduce((a, b) => a + b, 0)
          return (
            <>
              <div className="grid stats">
                <Stat label="Active accounts" to="/admin/users" value={accounts} hint={Object.entries(d.roles).map(([r, n]) => `${n} ${ROLE_LABEL[r].toLowerCase()}`).join(' · ')} />
                <Stat label="Disabled / locked" to="/admin/users" value={`${d.disabled} / ${d.locked}`} tone={d.locked ? 'warn' : undefined} />
                <Stat label="Failed sign-ins (24 h)" to="/admin/audit" value={d.failedLogins24h} tone={d.failedLogins24h > 10 ? 'bad' : undefined} />
                <Stat label="Open document requests" to="/admin/reports" value={d.openRequests} />
                <Stat label="Queue tickets today" to="/admin/reports" value={d.ticketsToday} />
                <Stat label="Collected today" to="/admin/reports" value={peso(d.collectedToday)} tone="ok" />
              </div>
              <Card title="Recent system activity" sub={d.term} flush actions={<Link className="btn small secondary" to="/admin/audit">Full audit log</Link>}>
                <Table
                  rowKey="createdAt"
                  empty="No activity yet."
                  columns={[
                    { key: 'createdAt', label: 'When', render: (r) => fmtDateTime(r.createdAt) },
                    { key: 'actor', label: 'Who', render: (r) => r.actor ?? 'Anonymous' },
                    { key: 'action', label: 'Action', render: (r) => <span className="mono">{r.action}</span> },
                    { key: 'detail', label: 'Details', render: (r) => r.detail ?? '—' },
                  ]}
                  rows={d.recent}
                />
              </Card>
            </>
          )
        }}
      </Async>
    </div>
  )
}
