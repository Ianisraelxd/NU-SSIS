import { useState } from 'react'
import { Async, Badge, Card, Modal, PageHead, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtDate, fmtDateTime, peso } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'
import RequestActions from './RequestActions.jsx'

const STATUSES = ['open', 'Pending', 'For Payment', 'Processing', 'Ready for Release', 'Released', 'Cancelled', 'all']
const LABEL = { open: 'Open', all: 'All' }

function Details({ id, onClose, onChange }) {
  const state = useApi(`/registrar/requests/${id}`)
  return (
    <Modal title="Request details" onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <Async state={state}>
        {(r) => (
          <div className="stack" style={{ gap: 18 }}>
            <dl className="kv">
              <dt>Request</dt>
              <dd>
                {r.requestNo} · <Badge status={r.status} />
              </dd>
              <dt>Student</dt>
              <dd>
                {r.studentName} ({r.studentNo})
              </dd>
              <dt>Document</dt>
              <dd>
                {r.document}
                {r.copies > 1 ? ` × ${r.copies}` : ''}
              </dd>
              <dt>Fee</dt>
              <dd>{r.totalFee > 0 ? peso(r.totalFee) : 'Free'}</dd>
              {r.orNumber && (
                <>
                  <dt>Receipt</dt>
                  <dd>
                    {r.orNumber} · {fmtDateTime(r.paidAt)}
                  </dd>
                </>
              )}
              <dt>Pickup</dt>
              <dd>{fmtDate(r.pickupDate)}</dd>
              {r.purpose && (
                <>
                  <dt>Purpose</dt>
                  <dd>{r.purpose}</dd>
                </>
              )}
              {r.remarks && (
                <>
                  <dt>Remarks</dt>
                  <dd>{r.remarks}</dd>
                </>
              )}
            </dl>
            <ol className="timeline">
              {r.history.map((h, i) => (
                <li key={i}>
                  <b>{h.status}</b> <span className="muted">— {h.note}{h.byName ? ` · ${h.byName}` : ''}</span>
                  <time>{fmtDateTime(h.createdAt)}</time>
                </li>
              ))}
            </ol>
            <RequestActions
              request={r}
              onChange={() => {
                state.reload()
                onChange()
              }}
            />
          </div>
        )}
      </Async>
    </Modal>
  )
}

export default function Requests() {
  const toast = useToast()
  const [filters, setFilters] = useState({ q: '', status: 'open', type: 'all' })
  const [open, setOpen] = useState(null)
  const q = useDebounced(filters.q)
  const query = new URLSearchParams({ status: filters.status, type: filters.type, ...(q ? { q } : {}) }).toString()
  const state = useApi(`/registrar/requests?${query}`)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  const processNext = async () => {
    try {
      const r = await api.post('/registrar/requests/next')
      toast(`${r.requestNo} approved → ${r.status}`)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Document Requests" subtitle="Approve, process and release the documents students ask for.">
        <button className="btn" onClick={processNext}>
          Approve next pending
        </button>
      </PageHead>
      <div className="stack">
        {state.data && (
          <div className="pipeline" role="group" aria-label="Filter by status">
            {STATUSES.map((s) => (
              <button key={s} aria-pressed={filters.status === s} onClick={() => setFilters((f) => ({ ...f, status: s }))}>
                {LABEL[s] ?? s}
                {state.data.counts[s] != null && <b>{state.data.counts[s]}</b>}
              </button>
            ))}
          </div>
        )}
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="rq-search">
            Search requests
          </label>
          <input id="rq-search" className="input grow" placeholder="Search student name, number or request no." value={filters.q} onChange={set('q')} />
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
                        <span className="muted">{r.totalFee > 0 ? peso(r.totalFee) : 'Free'}</span>
                      </>
                    ),
                  },
                  { key: 'createdAt', label: 'Filed', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                  { key: 'actions', label: 'Action', render: (r) => <RequestActions request={r} onChange={state.reload} compact /> },
                  {
                    key: 'details',
                    label: '',
                    render: (r) => (
                      <button className="btn small secondary" onClick={() => setOpen(r.id)}>
                        Details
                      </button>
                    ),
                  },
                ]}
                rows={d.requests}
              />
            </Card>
          )}
        </Async>
      </div>
      {open && <Details id={open} onClose={() => setOpen(null)} onChange={state.reload} />}
    </>
  )
}
