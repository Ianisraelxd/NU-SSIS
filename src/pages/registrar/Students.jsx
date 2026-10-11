import { useState } from 'react'
import TempPassword from '../../components/TempPassword.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const STANDINGS = ['Regular', 'Irregular', 'Probation', 'On leave', 'Graduated']
const blank = { studentNo: '', name: '', email: '', phone: '', program: '', departmentId: '', yearLevel: 1, section: '', standing: 'Regular', address: '', guardianName: '', guardianPhone: '' }

function StudentForm({ student, meta, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!student
  const [form, setForm] = useState(editing ? { ...blank, ...student, departmentId: student.departmentId ?? '', email: student.email ?? '', phone: student.phone ?? '', address: student.address ?? '', guardianName: student.guardianName ?? '', guardianPhone: student.guardianPhone ?? '' } : blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const programs = meta.programs.filter((p) => !form.departmentId || p.departmentId === Number(form.departmentId))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = editing ? await api.put(`/registrar/students/${student.id}`, form) : await api.post('/registrar/students', form)
      toast(editing ? 'Student record saved.' : 'Student added.')
      onSaved(editing ? null : result)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? `Edit ${student.name}` : 'Add a student'} wide onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="row">
          {!editing && (
            <Field label="Student number" htmlFor="sf-no" help="Used to sign in, e.g. 26001011">
              <input id="sf-no" className="input" value={form.studentNo} onChange={set('studentNo')} />
            </Field>
          )}
          <Field label="Full name" htmlFor="sf-name">
            <input id="sf-name" className="input" value={form.name} onChange={set('name')} />
          </Field>
        </div>
        <div className="row">
          <Field label="Email" htmlFor="sf-email">
            <input id="sf-email" type="email" className="input" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Mobile number" htmlFor="sf-phone">
            <input id="sf-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
        <div className="row">
          <Field label="Department" htmlFor="sf-dept">
            <select id="sf-dept" className="select" value={form.departmentId} onChange={set('departmentId')}>
              <option value="">— none —</option>
              {meta.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Program" htmlFor="sf-prog">
            <input id="sf-prog" className="input" list="programs" value={form.program} onChange={set('program')} placeholder="e.g. BS Information Technology" />
            <datalist id="programs">
              {programs.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="row">
          <Field label="Year level" htmlFor="sf-year">
            <select id="sf-year" className="select" value={form.yearLevel} onChange={set('yearLevel')}>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Section" htmlFor="sf-sec">
            <input id="sf-sec" className="input" value={form.section} onChange={set('section')} placeholder="e.g. 3IT-C" />
          </Field>
          <Field label="Standing" htmlFor="sf-stand">
            <select id="sf-stand" className="select" value={form.standing} onChange={set('standing')}>
              {STANDINGS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Address" htmlFor="sf-addr">
          <input id="sf-addr" className="input" value={form.address} onChange={set('address')} />
        </Field>
        <div className="row">
          <Field label="Guardian name" htmlFor="sf-gn">
            <input id="sf-gn" className="input" value={form.guardianName} onChange={set('guardianName')} />
          </Field>
          <Field label="Guardian contact" htmlFor="sf-gp">
            <input id="sf-gp" className="input" value={form.guardianPhone} onChange={set('guardianPhone')} />
          </Field>
        </div>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
            {error}
          </p>
        )}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {editing ? 'Save changes' : 'Add student'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Students() {
  const toast = useToast()
  const meta = useApi('/meta')
  const [filters, setFilters] = useState({ q: '', dept: 'all', verified: 'all' })
  const q = useDebounced(filters.q)
  const state = useApi(`/registrar/students?${new URLSearchParams({ q, dept: filters.dept, verified: filters.verified })}`)
  const [form, setForm] = useState(null) // null | 'new' | student
  const [secret, setSecret] = useState(null)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  const verify = async (s) => {
    try {
      await api.post(`/registrar/students/${s.id}/verify`)
      toast(`${s.name} verified.`)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Student Records" subtitle="Add and update student records, and verify their academic information.">
        <button className="btn" onClick={() => setForm('new')} disabled={!meta.data}>
          + Add student
        </button>
      </PageHead>
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="st-q">
            Search students
          </label>
          <input id="st-q" className="input grow" placeholder="Search name or student number" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="st-d">
            Department
          </label>
          <select id="st-d" className="select" value={filters.dept} onChange={set('dept')}>
            <option value="all">All departments</option>
            {(meta.data?.departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="st-v">
            Verification
          </label>
          <select id="st-v" className="select" value={filters.verified} onChange={set('verified')}>
            <option value="all">Verified and not</option>
            <option value="yes">Verified</option>
            <option value="no">Not verified</option>
          </select>
        </div>
        <Async state={state}>
          {({ students }) => (
            <Card flush title={`${students.length} student${students.length === 1 ? '' : 's'}`}>
              <Table
                empty="No students match."
                columns={[
                  { key: 'studentNo', label: 'Student no.', render: (s) => <span className="mono">{s.studentNo}</span> },
                  {
                    key: 'name',
                    label: 'Name',
                    render: (s) => (
                      <>
                        <b>{s.name}</b>
                        <br />
                        <span className="muted">{s.program}</span>
                      </>
                    ),
                  },
                  { key: 'section', label: 'Year / section', render: (s) => `${s.yearLevel} · ${s.section}` },
                  { key: 'deptCode', label: 'Dept.', render: (s) => s.deptCode ?? '—' },
                  { key: 'enrollment', label: 'Enrollment', render: (s) => <Badge status={s.enrollment} /> },
                  { key: 'verified', label: 'Records', render: (s) => (s.verified ? <Badge status="Verified" /> : <Badge status="Pending">Not verified</Badge>) },
                  {
                    key: 'actions',
                    label: '',
                    render: (s) => (
                      <div className="actions">
                        {!s.verified && (
                          <button className="btn small" onClick={() => verify(s)}>
                            Verify
                          </button>
                        )}
                        <button className="btn small secondary" onClick={() => setForm(s)}>
                          Edit
                        </button>
                      </div>
                    ),
                  },
                ]}
                rows={students}
              />
            </Card>
          )}
        </Async>
      </div>
      {form && meta.data && (
        <StudentForm
          student={form === 'new' ? null : form}
          meta={meta.data}
          onClose={() => setForm(null)}
          onSaved={(created) => {
            setForm(null)
            state.reload()
            if (created) setSecret({ loginId: created.studentNo, password: created.tempPassword })
          }}
        />
      )}
      {secret && <TempPassword title="Student account created" loginId={secret.loginId} password={secret.password} onClose={() => setSecret(null)} />}
    </>
  )
}
