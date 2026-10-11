import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { useApi, useDebounced } from '../../lib/hooks.js'
import { StudentModal } from './Students.jsx'

export default function DepartmentClearance() {
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const state = useApi(`/department/students?q=${encodeURIComponent(search)}`)
  const [open, setOpen] = useState(null)

  return (
    <>
      <PageHead title="Clearance" subtitle="Monitor your students’ clearance and approve the department line." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="dc-q">
            Search students
          </label>
          <input id="dc-q" className="input grow" placeholder="Search name or student number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Async state={state}>
          {({ students }) => (
            <Card flush title={`${students.length} student${students.length === 1 ? '' : 's'}`}>
              <Table
                empty="No students match."
                columns={[
                  { key: 'studentNo', label: 'Student no.', render: (s) => <span className="mono">{s.studentNo}</span> },
                  { key: 'name', label: 'Name', render: (s) => <b>{s.name}</b> },
                  { key: 'deptClearance', label: 'Department line', render: (s) => <Badge status={s.deptClearance} /> },
                  { key: 'requirements', label: 'Requirements', align: 'center', render: (s) => (s.requirements.total ? `${s.requirements.verified} / ${s.requirements.total} verified` : 'none') },
                  { key: 'clearance', label: 'All offices', align: 'center', render: (s) => `${s.clearance.cleared} / ${s.clearance.total} cleared` },
                  { key: 'overall', label: 'Overall', render: (s) => <Badge status={s.clearance.hold ? 'Hold' : s.clearance.complete ? 'Cleared' : 'Pending'} /> },
                  {
                    key: 'x',
                    label: '',
                    render: (s) => (
                      <button className="btn small secondary" onClick={() => setOpen(s.id)}>
                        Review
                      </button>
                    ),
                  },
                ]}
                rows={students}
              />
            </Card>
          )}
        </Async>
      </div>
      {open && <StudentModal id={open} onClose={() => setOpen(null)} onChanged={state.reload} />}
    </>
  )
}
