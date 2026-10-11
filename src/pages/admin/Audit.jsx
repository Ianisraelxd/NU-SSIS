import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { ROLE_LABEL, fmtDateTime } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const PAGE = 50

const toneOf = (action) => (action.includes('failed') || action.includes('locked') || action.includes('void') || action.includes('delete') ? 'bad' : action.startsWith('login') ? 'muted' : 'info')

export default function Audit() {
  const [filters, setFilters] = useState({ q: '', role: 'all' })
  const [page, setPage] = useState(0)
  const q = useDebounced(filters.q)
  const state = useApi(`/admin/audit?${new URLSearchParams({ q, role: filters.role, limit: PAGE, offset: page * PAGE })}`)
  const set = (k) => (e) => {
    setPage(0)
    setFilters((f) => ({ ...f, [k]: e.target.value }))
  }

  return (
    <>
      <PageHead title="Audit Log" subtitle="Who did what, and when. Sign-ins, record changes, payments and settings are all recorded." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="au-q">
            Search the log
          </label>
          <input id="au-q" className="input grow" placeholder="Search person, action or details" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="au-r">
            Role
          </label>
          <select id="au-r" className="select" value={filters.role} onChange={set('role')}>
            <option value="all">Every role</option>
            {Object.entries(ROLE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Async state={state}>
          {({ rows, total }) => (
            <Card flush title={`${total} entr${total === 1 ? 'y' : 'ies'}`}>
              <Table
                empty="Nothing matches."
                columns={[
                  { key: 'createdAt', label: 'When', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'actor', label: 'Who', render: (r) => r.actor ?? <span className="muted">Anonymous</span> },
                  { key: 'role', label: 'Role', render: (r) => (r.role ? ROLE_LABEL[r.role] : '—') },
                  { key: 'action', label: 'Action', render: (r) => <Badge tone={toneOf(r.action)}>{r.action}</Badge> },
                  { key: 'entity', label: 'Target', render: (r) => (r.entityId ? `${r.entity} ${r.entityId}` : r.entity ?? '—') },
                  { key: 'detail', label: 'Details', render: (r) => r.detail ?? '—' },
                ]}
                rows={rows}
              />
              <div className="toolbar spread" style={{ padding: 14 }}>
                <span className="muted">
                  {total === 0 ? 0 : page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total}
                </span>
                <div className="actions">
                  <button className="btn small secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    ← Newer
                  </button>
                  <button className="btn small secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>
                    Older →
                  </button>
                </div>
              </div>
            </Card>
          )}
        </Async>
      </div>
    </>
  )
}
