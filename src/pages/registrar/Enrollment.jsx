import { useState } from 'react'
import ScheduleReview from '../../components/ScheduleReview.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { fmtDateTime } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const FILTERS = [
  ['For Registrar Approval', 'Waiting for approval'],
  ['Approved', 'Approved'],
  ['Returned', 'Returned'],
  ['all', 'All'],
]

function ReturnDialog({ request, onClose, onDone }) {
  const toast = useToast()
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const send = async () => {
    try {
      await api.patch(`/registrar/enrollment/${request.id}`, { decision: 'return', remarks })
      toast('Returned to the student.')
      onDone()
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <Modal
      title={`Return ${request.studentName}’s enrollment`}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger-solid" onClick={send}>
            Return to student
          </button>
        </>
      }
    >
      <Field label="What does the student need to fix?" htmlFor="ret" error={error}>
        <textarea id="ret" className="textarea" rows={4} maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
    </Modal>
  )
}

export default function RegistrarEnrollment() {
  const toast = useToast()
  const [status, setStatus] = useState('For Registrar Approval')
  const state = useApi(`/registrar/enrollment?status=${encodeURIComponent(status)}`)
  const [returning, setReturning] = useState(null)

  const approve = async (r, e) => {
    const target = e.currentTarget
    try {
      await api.patch(`/registrar/enrollment/${r.id}`, { decision: 'approve' })
      burst(target)
      toast(`${r.studentName}’s enrollment approved.`)
      state.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Enrollment" subtitle="Verify records and approve enrollment after the department has reviewed the subjects." />
      <div className="stack">
        <div className="pipeline" role="group" aria-label="Filter">
          {FILTERS.map(([key, label]) => (
            <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)}>
              {label}
            </button>
          ))}
        </div>
        <Async state={state}>
          {(d) => (
            <div className="stack">
              <p className="muted">{d.term}</p>
              {d.requests.length === 0 && (
                <Card>
                  <p className="empty">Nothing here right now.</p>
                </Card>
              )}
              {d.requests.map((r) => (
                <Card key={r.id}>
                  <div className="card-head">
                    <div>
                      <h2>
                        {r.studentName} <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>({r.studentNo})</span>
                      </h2>
                      <p className="sub">
                        {r.program} · {r.yearLevel}-{r.section} · {r.deptCode}
                      </p>
                    </div>
                    <div className="actions">
                      <Badge status={r.status} />
                      {!r.verified && <Badge tone="bad">Records not verified</Badge>}
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Subject code</th>
                          <th>Subject description</th>
                          <th className="center">Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.subjects.map((s) => (
                          <tr key={s.code}>
                            <td>
                              <b>{s.code}</b>
                            </td>
                            <td>{s.description}</td>
                            <td className="center">{s.units}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>Total units</td>
                          <td className="center">{r.units}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <ScheduleReview schedule={r.schedule} conflicts={r.conflicts} />
                  <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                    Submitted {fmtDateTime(r.submittedAt)}
                    {r.deptReviewedAt ? ` · reviewed by ${r.deptReviewer ?? 'department'} ${fmtDateTime(r.deptReviewedAt)}` : ''}
                    {r.remarks ? ` · Note: ${r.remarks}` : ''}
                  </p>
                  {r.status === 'For Registrar Approval' && (
                    <div className="actions" style={{ marginTop: 14 }}>
                      <button className="btn" disabled={r.conflicts.length > 0} title={r.conflicts.length ? 'Schedule conflict — return it to the student' : undefined} onClick={(e) => approve(r, e)}>
                        Approve enrollment
                      </button>
                      <button className="btn danger" onClick={() => setReturning(r)}>
                        Return to student
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Async>
      </div>
      {returning && (
        <ReturnDialog
          request={returning}
          onClose={() => setReturning(null)}
          onDone={() => {
            setReturning(null)
            state.reload()
          }}
        />
      )}
    </>
  )
}
