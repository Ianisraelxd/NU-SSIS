import { useEffect, useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { fmtDate, fmtDateTime, peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import RequestActions from './RequestActions.jsx'

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function Requests() {
  const [filters, setFilters] = useState({ q: '', status: 'open', type: 'all' })
  const q = useDebounced(filters.q)
  const query = new URLSearchParams({ status: filters.status, type: filters.type, ...(q ? { q } : {}) }).toString()
  const state = useApi(`/registrar/requests?${query}`)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHead title="Document Requests" subtitle="Every document request filed by students." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="rq-search">
            Search requests
          </label>
          <input id="rq-search" className="input grow" placeholder="Search student name, number or request no." value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="rq-status">
            Status
          </label>
          <select id="rq-status" className="select" value={filters.status} onChange={set('status')}>
            <option value="open">Open (not yet released)</option>
            <option value="all">All statuses</option>
            {['Pending', 'Processing', 'Ready', 'Completed', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="rq-type">
            Document type
          </label>
          <select id="rq-type" className="select" value={filters.type} onChange={set('type')}>
            <option value="all">All documents</option>
            {(state.data?.types ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <Async state={state}>
          {(d) => (
            <Card flush title={`${d.requests.length} request${d.requests.length === 1 ? '' : 's'}`}>
              <Table
                empty="No requests match these filters."
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
                  {
                    key: 'document',
                    label: 'Document',
                    render: (r) => (
                      <>
                        {r.document}
                        {r.copies > 1 ? ` ×${r.copies}` : ''}
                        <br />
                        <span className="muted">{peso(r.totalFee)}</span>
                      </>
                    ),
                  },
                  { key: 'createdAt', label: 'Filed', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'pickupDate', label: 'Pickup', render: (r) => fmtDate(r.pickupDate) },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                  { key: 'actions', label: 'Action', render: (r) => <RequestActions request={r} onChange={state.reload} compact /> },
                ]}
                rows={d.requests}
              />
            </Card>
          )}
        </Async>
      </div>
    </>
  )
}
