import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { ROLE_LABEL, fmtDateTime } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const PAGE = 50

export default function LoginAttempts() {
  const [filters, setFilters] = useState({ q: '', result: 'all' })
  const [page, setPage] = useState(0)
  const q = useDebounced(filters.q)
  const state = useApi(`/admin/login-attempts?${new URLSearchParams({ q, result: filters.result, limit: PAGE, offset: page * PAGE })}`)
  const set = (k) => (e) => {
    setPage(0)
    setFilters((f) => ({ ...f, [k]: e.target.value }))
  }

  return (
    <>
      <PageHead title="Login Attempts" subtitle="Every sign-in attempt, successful or not, with the time, address and reason. Passwords are never recorded." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="la-q">
            Search attempts
          </label>
          <input id="la-q" className="input grow" placeholder="Search ID, address or reason" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="la-r">
            Result
          </label>
          <select id="la-r" className="select" value={filters.result} onChange={set('result')}>
            <option value="all">All attempts</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <Async state={state}>
          {({ rows, total, failed24h }) => (
            <Card flush title={`${total} attempt${total === 1 ? '' : 's'} · ${failed24h} failed in the last 24 hours`}>
              <Table
                empty="No attempts match."
                columns={[
                  { key: 'createdAt', label: 'Date and time', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'loginId', label: 'ID entered', render: (r) => r.loginId || '—' },
                  { key: 'role', label: 'Portal used', render: (r) => (r.role ? ROLE_LABEL[r.role] ?? r.role : '—') },
                  { key: 'success', label: 'Sign-in result', render: (r) => <Badge tone={r.success ? 'good' : 'bad'}>{r.success ? 'Success' : 'Failed'}</Badge> },
                  { key: 'reason', label: 'Reason for the result', render: (r) => r.reason ?? '—' },
                  { key: 'ip', label: 'IP address', render: (r) => r.ip ?? '—' },
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
