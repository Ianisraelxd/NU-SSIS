import { useState } from 'react'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function OfficeRow({ row, onSaved }) {
  const toast = useToast()
  const [status, setStatus] = useState(row.status)
  const [remarks, setRemarks] = useState(row.remarks ?? '')
  const [busy, setBusy] = useState(false)
  const locked = row.office === 'Cashier'
  const dirty = status !== row.status || (remarks || '') !== (row.remarks ?? '')

  const save = async () => {
    setBusy(true)
    try {
      await api.put(`/registrar/clearance/item/${row.id}`, { status, remarks })
      toast(`${row.office} updated.`)
      onSaved()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr>
      <td>
        <b>{row.office}</b>
        <br />
        <span className="muted">{row.requirement}</span>
      </td>
      <td>
        {locked ? (
          <Badge status={row.status} />
        ) : (
          <select className="select" aria-label={`${row.office} status`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Cleared</option>
            <option>Pending</option>
            <option>Hold</option>
          </select>
        )}
      </td>
      <td>
        {locked ? (
          <span className="muted">{row.remarks ?? 'Follows balance'}</span>
        ) : (
          <input
            className="input"
            aria-label={`${row.office} remarks`}
            placeholder={status === 'Cleared' ? '—' : 'Reason / what to submit'}
            value={status === 'Cleared' ? '' : remarks}
            disabled={status === 'Cleared'}
            onChange={(e) => setRemarks(e.target.value)}
          />
        )}
      </td>
      <td>
        {!locked && (
          <button className="btn small" disabled={!dirty || busy} onClick={save}>
            Save
          </button>
        )}
      </td>
    </tr>
  )
}

function StudentModal({ id, onClose, onChanged }) {
  const toast = useToast()
  const state = useApi(`/registrar/clearance/${id}`)
  const [stepDraft, setStep] = useState(null)
  const step = stepDraft ?? state.data?.student.step ?? 0

  const saveStep = async () => {
    try {
      await api.put(`/registrar/students/${id}/enrollment`, { step: Number(step) })
      toast('Enrollment progress updated.')
      setStep(null)
      state.reload()
      onChanged()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const refresh = () => {
    state.reload()
    onChanged()
  }

  return (
    <Modal title={state.data ? `${state.data.student.name} · ${state.data.student.studentNo}` : 'Student clearance'} onClose={onClose}>
      <Async state={state}>
        {(d) => (
          <div className="stack" style={{ gap: 20 }}>
            <dl className="kv">
              <dt>Program</dt>
              <dd>
                {d.student.program} · {d.student.section}
              </dd>
              <dt>Balance</dt>
              <dd>{peso(d.student.balance)}</dd>
              <dt>Clearance</dt>
              <dd>
                {d.summary.cleared} of {d.summary.total} cleared
              </dd>
            </dl>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Office</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.offices.map((o) => (
                    <OfficeRow key={`${o.id}-${o.status}-${o.remarks}`} row={o} onSaved={refresh} />
                  ))}
                </tbody>
              </table>
            </div>
            <Field label="Enrollment progress" htmlFor="enr-step" help="Moves the student’s enrollment stepper.">
              <div className="toolbar">
                <select id="enr-step" className="select" value={step ?? 0} onChange={(e) => setStep(e.target.value)}>
                  <option value={0}>Not started</option>
                  {d.student.steps.map((s, i) => (
                    <option key={s} value={i + 1}>
                      {s} done
                    </option>
                  ))}
                </select>
                <button className="btn small" onClick={saveStep} disabled={Number(step) === d.student.step}>
                  Update
                </button>
              </div>
            </Field>
          </div>
        )}
      </Async>
    </Modal>
  )
}

export default function Clearance() {
  const [filters, setFilters] = useState({ q: '', status: 'all' })
  const [openId, setOpenId] = useState(null)
  const query = new URLSearchParams({ status: filters.status, q: filters.q }).toString()
  const state = useApi(`/registrar/clearance?${query}`)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHead title="Clearance Status" subtitle="Review and update each student’s clearance per office." />
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="cl-search">
            Search students
          </label>
          <input id="cl-search" className="input grow" placeholder="Search student name or number" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="cl-status">
            Status
          </label>
          <select id="cl-status" className="select" value={filters.status} onChange={set('status')}>
            <option value="all">All students</option>
            <option value="Cleared">Fully cleared</option>
            <option value="Pending">Has pending</option>
            <option value="Hold">On hold</option>
          </select>
        </div>
        <Async state={state}>
          {(d) => (
            <Card flush title={`${d.students.length} student${d.students.length === 1 ? '' : 's'}`}>
              <Table
                empty="No students match these filters."
                columns={[
                  { key: 'studentNo', label: 'Student no.', render: (s) => <span className="mono">{s.studentNo}</span> },
                  { key: 'name', label: 'Name', render: (s) => <b>{s.name}</b> },
                  { key: 'section', label: 'Year / section', render: (s) => `${s.yearLevel} · ${s.section}` },
                  { key: 'cleared', label: 'Cleared', align: 'center', render: (s) => `${s.cleared} / ${s.total}` },
                  { key: 'overall', label: 'Status', render: (s) => <Badge status={s.overall} /> },
                  { key: 'balance', label: 'Balance', align: 'num', render: (s) => peso(s.balance) },
                  {
                    key: 'manage',
                    label: '',
                    render: (s) => (
                      <button className="btn small secondary" onClick={() => setOpenId(s.id)}>
                        Manage
                      </button>
                    ),
                  },
                ]}
                rows={d.students}
              />
            </Card>
          )}
        </Async>
      </div>
      {openId && <StudentModal id={openId} onClose={() => setOpenId(null)} onChanged={state.reload} />}
    </>
  )
}
