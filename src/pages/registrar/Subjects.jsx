import { useState } from 'react'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { DAYS, fmtMinutes } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

function SubjectForm({ subject, meta, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!subject
  const [form, setForm] = useState(subject ? { ...subject, departmentId: subject.departmentId ?? '' } : { code: '', description: '', units: 3, yearLevel: 1, offered: true, departmentId: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) await api.put(`/registrar/subjects/${subject.id}`, form)
      else await api.post('/registrar/subjects', form)
      toast(editing ? 'Subject saved.' : 'Subject added.')
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title={editing ? `Edit ${subject.code}` : 'Add a subject'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="row">
          <Field label="Subject code" htmlFor="sj-code">
            <input id="sj-code" className="input" value={form.code} onChange={set('code')} />
          </Field>
          <Field label="Units" htmlFor="sj-units">
            <input id="sj-units" type="number" min="1" max="12" className="input" value={form.units} onChange={set('units')} />
          </Field>
        </div>
        <Field label="Subject description" htmlFor="sj-desc">
          <input id="sj-desc" className="input" value={form.description} onChange={set('description')} />
        </Field>
        <div className="row">
          <Field label="Year level" htmlFor="sj-year">
            <select id="sj-year" className="select" value={form.yearLevel} onChange={set('yearLevel')}>
              {[0, 1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  {y === 0 ? 'Any' : y}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department" htmlFor="sj-dept" help="Blank = open to every department">
            <select id="sj-dept" className="select" value={form.departmentId} onChange={set('departmentId')}>
              <option value="">All departments</option>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="switch" style={{ borderBottom: 0 }}>
          <div>
            <b>Offered this term</b>
            <p>Students can only pick subjects that are offered.</p>
          </div>
          <input type="checkbox" checked={!!form.offered} onChange={set('offered')} />
        </label>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
            {error}
          </p>
        )}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn">{editing ? 'Save' : 'Add subject'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Schedule({ subjectId, onClose, onChanged }) {
  const toast = useToast()
  const all = useApi('/registrar/subjects')
  const subject = all.data?.subjects.find((s) => s.id === subjectId)
  const [form, setForm] = useState({ instructor: '', day: 1, start: '08:00', end: '09:30', room: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const add = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post(`/registrar/subjects/${subjectId}/meetings`, { instructor: form.instructor, day: Number(form.day), startMin: toMinutes(form.start), endMin: toMinutes(form.end), room: form.room })
      toast('Class meeting added.')
      all.reload()
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }
  const remove = async (id) => {
    try {
      await api.delete(`/registrar/meetings/${id}`)
      all.reload()
      onChanged()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <Modal title={subject ? `Schedule · ${subject.code}` : 'Schedule'} wide onClose={onClose} footer={<button className="btn" onClick={onClose}>Done</button>}>
      <Async state={all}>
        {() => (
          <div className="stack" style={{ gap: 20 }}>
            <Table
              empty="No class meetings yet. Add one below."
              columns={[
                { key: 'day', label: 'Day', render: (m) => DAYS[m.day - 1] },
                { key: 'time', label: 'Class time', render: (m) => `${fmtMinutes(m.startMin)} – ${fmtMinutes(m.endMin)}` },
                { key: 'room', label: 'Room' },
                { key: 'instructor', label: 'Instructor' },
                {
                  key: 'x',
                  label: 'Actions',
                  render: (m) => (
                    <button className="btn small danger" onClick={() => remove(m.id)}>
                      Remove
                    </button>
                  ),
                },
              ]}
              rows={subject?.meetings ?? []}
            />
            <form onSubmit={add} noValidate>
              <h3 className="mini-title" style={{ marginTop: 0 }}>
                Add a class meeting
              </h3>
              <div className="row">
                <Field label="Class day" htmlFor="m-day">
                  <select id="m-day" className="select" value={form.day} onChange={set('day')}>
                    {DAYS.map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Class start time" htmlFor="m-start">
                  <input id="m-start" type="time" className="input" value={form.start} onChange={set('start')} />
                </Field>
                <Field label="Class end time" htmlFor="m-end">
                  <input id="m-end" type="time" className="input" value={form.end} onChange={set('end')} />
                </Field>
              </div>
              <div className="row">
                <Field label="Room" htmlFor="m-room">
                  <input id="m-room" className="input" value={form.room} onChange={set('room')} placeholder="e.g. COMLAB 2" />
                </Field>
                <Field label="Instructor" htmlFor="m-ins">
                  <input id="m-ins" className="input" value={form.instructor} onChange={set('instructor')} />
                </Field>
              </div>
              {error && (
                <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
                  {error}
                </p>
              )}
              <button className="btn">Add meeting</button>
            </form>
          </div>
        )}
      </Async>
    </Modal>
  )
}

export default function Subjects() {
  const toast = useToast()
  const confirm = useConfirm()
  const state = useApi('/registrar/subjects')
  const meta = useApi('/meta')
  const [form, setForm] = useState(null)
  const [schedule, setSchedule] = useState(null)

  const remove = async (s) => {
    const ok = await confirm({ title: `Delete ${s.code}?`, message: 'The subject and its class schedule will be removed.', confirmLabel: 'Delete subject' })
    if (!ok) return
    try {
      await api.delete(`/registrar/subjects/${s.id}`)
      toast('Subject deleted.')
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Subjects & Schedules" subtitle="Manage the subjects students can enroll in and their class schedules.">
        <button className="btn" onClick={() => setForm('new')} disabled={!meta.data}>
          + Add subject
        </button>
      </PageHead>
      <Async state={state}>
        {({ subjects }) => (
          <Card flush title={`${subjects.length} subjects`}>
            <Table
              columns={[
                { key: 'code', label: 'Subject code', render: (s) => <b>{s.code}</b> },
                { key: 'description', label: 'Subject description' },
                { key: 'units', label: 'Units', align: 'center' },
                { key: 'deptCode', label: 'Department', render: (s) => s.deptCode ?? 'All' },
                { key: 'offered', label: 'Offered this term', render: (s) => (s.offered ? <Badge status="Active">Offered</Badge> : <Badge status="Cancelled">Not offered</Badge>) },
                { key: 'meetings', label: 'Class meetings', render: (s) => (s.meetings.length ? `${s.meetings.length} meeting${s.meetings.length === 1 ? '' : 's'}` : <span className="muted">none yet</span>) },
                { key: 'enrolled', label: 'Students enrolled', align: 'center' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (s) => (
                    <div className="actions">
                      <button className="btn small secondary" onClick={() => setSchedule(s.id)}>
                        Schedule
                      </button>
                      <button className="btn small secondary" onClick={() => setForm(s)}>
                        Edit
                      </button>
                      <button className="btn small danger" onClick={() => remove(s)}>
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              rows={subjects}
            />
          </Card>
        )}
      </Async>
      {form && meta.data && (
        <SubjectForm
          subject={form === 'new' ? null : form}
          meta={meta.data}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            state.reload()
          }}
        />
      )}
      {schedule && <Schedule subjectId={schedule} onClose={() => setSchedule(null)} onChanged={state.reload} />}
    </>
  )
}
