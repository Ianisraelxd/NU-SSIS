import { useState } from 'react'
import { Async, Badge, Card, Modal, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtShort, peso, point } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const dash = (v) => (v == null ? '--' : v.toFixed(2))

// One dialog for everything a department does with a student: grades, requirements and the department clearance line.
export function StudentModal({ id, onClose, onChanged }) {
  const state = useApi(`/department/students/${id}`)
  const toast = useToast()
  const confirm = useConfirm()
  const [newReq, setNewReq] = useState('')
  const [remarks, setRemarks] = useState('')

  const refresh = () => {
    state.reload()
    onChanged()
  }
  const run = async (fn, ok) => {
    try {
      await fn()
      if (ok) toast(ok)
      refresh()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const removeReq = async (r) => {
    const ok = await confirm({ title: `Remove “${r.name}”?`, message: 'It will no longer count toward this student’s clearance.', confirmLabel: 'Remove' })
    if (ok) run(() => api.delete(`/department/requirements/${r.id}`), 'Requirement removed.')
  }

  return (
    <Modal title={state.data ? `${state.data.student.name} · ${state.data.student.studentNo}` : 'Student'} wide onClose={onClose}>
      <Async state={state}>
        {(d) => {
          const head = d.offices.find((o) => o.office === 'Department Head')
          return (
            <div className="stack" style={{ gap: 22 }}>
              <dl className="kv">
                <dt>Program</dt>
                <dd>
                  {d.student.program} · {d.student.yearLevel}-{d.student.section}
                </dd>
                <dt>Enrollment</dt>
                <dd>
                  <Badge status={d.student.enrollment} />
                </dd>
                <dt>Balance</dt>
                <dd>{peso(d.student.balance)}</dd>
                <dt>Standing</dt>
                <dd>{d.student.standing}</dd>
              </dl>

              <Card title="Department clearance" sub="The “Department Head” line of the student’s E-Clearance" flush>
                <div style={{ padding: 18 }}>
                  <p style={{ marginBottom: 12 }}>
                    Current status: <Badge status={head.status} /> {head.remarks && <span className="muted">— {head.remarks}</span>}
                  </p>
                  <div className="toolbar">
                    <input className="input grow" aria-label="Remarks" placeholder="Remarks (shown to the student when on hold or pending)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    <button className="btn" onClick={() => run(() => api.put(`/department/students/${id}/clearance`, { status: 'Cleared' }), 'Department clearance approved.')}>
                      Approve
                    </button>
                    <button className="btn secondary" onClick={() => run(() => api.put(`/department/students/${id}/clearance`, { status: 'Pending', remarks }), 'Marked pending.')}>
                      Pending
                    </button>
                    <button className="btn danger" onClick={() => run(() => api.put(`/department/students/${id}/clearance`, { status: 'Hold', remarks }), 'Placed on hold.')}>
                      Hold
                    </button>
                  </div>
                </div>
              </Card>

              <Card title="Academic requirements" sub="Verify each requirement before approving clearance" flush>
                <Table
                  empty="No requirements yet. Add one below."
                  columns={[
                    { key: 'name', label: 'Requirement', render: (r) => <b>{r.name}</b> },
                    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                    { key: 'remarks', label: 'Notes', render: (r) => r.remarks ?? (r.verifiedAt ? `Verified ${fmtShort(r.verifiedAt)}` : '—') },
                    {
                      key: 'x',
                      label: 'Actions',
                      render: (r) => (
                        <div className="actions">
                          {r.status !== 'Verified' && (
                            <button className="btn small" onClick={() => run(() => api.patch(`/department/requirements/${r.id}`, { status: 'Verified' }), 'Requirement verified.')}>
                              Verify
                            </button>
                          )}
                          {r.status !== 'Missing' && (
                            <button className="btn small danger" onClick={() => run(() => api.patch(`/department/requirements/${r.id}`, { status: 'Missing', remarks: 'Not yet submitted to the department.' }), 'Marked missing.')}>
                              Missing
                            </button>
                          )}
                          <button className="btn small secondary" onClick={() => removeReq(r)}>
                            Remove
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rows={d.requirements}
                />
                <form
                  className="toolbar"
                  style={{ padding: 16 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    run(() => api.post(`/department/students/${id}/requirements`, { name: newReq }), 'Requirement added.').then(() => setNewReq(''))
                  }}
                >
                  <input className="input grow" aria-label="New requirement" placeholder="Add a requirement, e.g. Thesis manuscript" value={newReq} onChange={(e) => setNewReq(e.target.value)} />
                  <button className="btn small">Add</button>
                </form>
              </Card>

              <Card title="All clearance offices" sub="Read-only — other offices manage their own line" flush>
                <Table
                  columns={[
                    { key: 'office', label: 'Office', render: (o) => <b>{o.office}</b> },
                    { key: 'requirement', label: 'Requirement' },
                    { key: 'status', label: 'Status', render: (o) => <Badge status={o.status} /> },
                    { key: 'remarks', label: 'Remarks', render: (o) => o.remarks ?? '—' },
                  ]}
                  rows={d.offices}
                />
              </Card>

              <Card title="Grades" sub={`${d.term} · viewing grades is recorded in the audit log`} flush>
                <Table
                  rowKey="code"
                  empty="No subjects yet this term."
                  columns={[
                    { key: 'code', label: 'Subject code', render: (g) => <b>{g.code}</b> },
                    { key: 'description', label: 'Subject description' },
                    { key: 'units', label: 'Units', align: 'center' },
                    { key: 'prelim', label: 'Prelim grade', align: 'center', render: (g) => dash(g.prelim) },
                    { key: 'midterm', label: 'Midterm grade', align: 'center', render: (g) => dash(g.midterm) },
                    { key: 'finals', label: 'Finals grade', align: 'center', render: (g) => dash(g.finals) },
                    { key: 'final', label: 'Final grade', align: 'center', render: (g) => (g.final == null ? '--' : <b>{point(g.point)}</b>) },
                  ]}
                  rows={d.grades}
                />
              </Card>
            </div>
          )
        }}
      </Async>
    </Modal>
  )
}

export default function DepartmentStudents() {
  const [q, setQ] = useState('')
  const search = useDebounced(q)
  const state = useApi(`/department/students?q=${encodeURIComponent(search)}`)
  const [open, setOpen] = useState(null)

  return (
    <>
      <PageHead title="Students" subtitle="Students of your department — their requirements, clearance and grades." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="ds-q">
            Search students
          </label>
          <input id="ds-q" className="input grow" placeholder="Search name or student number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Async state={state}>
          {({ students }) => (
            <Card flush title={`${students.length} student${students.length === 1 ? '' : 's'}`}>
              <Table
                empty="No students match."
                columns={[
                  { key: 'studentNo', label: 'Student no.', render: (s) => <span className="mono">{s.studentNo}</span> },
                  { key: 'name', label: 'Student name', render: (s) => <b>{s.name}</b> },
                  { key: 'section', label: 'Year / section', render: (s) => `${s.yearLevel} · ${s.section}` },
                  { key: 'enrollment', label: 'Enrollment status', render: (s) => <Badge status={s.enrollment} /> },
                  { key: 'requirements', label: 'Requirements verified', align: 'center', render: (s) => (s.requirements.total ? `${s.requirements.verified} / ${s.requirements.total}` : '—') },
                  { key: 'deptClearance', label: 'Department clearance', render: (s) => <Badge status={s.deptClearance} /> },
                  {
                    key: 'x',
                    label: 'Actions',
                    render: (s) => (
                      <button className="btn small secondary" onClick={() => setOpen(s.id)}>
                        Open
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
