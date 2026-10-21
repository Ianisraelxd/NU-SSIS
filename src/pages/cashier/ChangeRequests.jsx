import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const FILTERS = [
  ['all', 'All requests'],
  ['Pending', 'Waiting for the Administrator'],
  ['Approved', 'Approved'],
  ['Rejected', 'Rejected'],
]

export default function CashierChangeRequests() {
  const [status, setStatus] = useState('all')
  const state = useApi(`/cashier/change-requests?status=${status}`)
  return (
    <>
      <PageHead title="Change Requests" subtitle="Fee changes and receipt voids you asked for. An Administrator approves or rejects each one; nothing changes before that." />
      <div className="stack">
        <div className="pipeline" role="group" aria-label="Show">
          {FILTERS.map(([key, label]) => (
            <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)}>
              {label}
            </button>
          ))}
        </div>
        <Async state={state}>
          {({ approvals }) => (
            <Card flush title={`${approvals.length} request${approvals.length === 1 ? '' : 's'}`}>
              <Table
                empty="No requests."
                columns={[
                  { key: 'requestedAt', label: 'Date and time requested', render: (r) => fmtDateTime(r.requestedAt) },
                  { key: 'studentName', label: 'Student', render: (r) => <span><b>{r.studentName}</b> <span className="muted">({r.studentNo})</span></span> },
                  { key: 'summary', label: 'What was asked' },
                  { key: 'reason', label: 'Reason given' },
                  { key: 'status', label: 'Decision', render: (r) => <Badge status={r.status} /> },
                  { key: 'decidedBy', label: 'Decided by', render: (r) => (r.decidedBy ? `${r.decidedBy}, ${fmtDateTime(r.decidedAt)}` : '—') },
                  { key: 'decisionNote', label: 'Administrator’s note', render: (r) => r.decisionNote ?? '—' },
                ]}
                rows={approvals}
              />
            </Card>
          )}
        </Async>
      </div>
    </>
  )
}
