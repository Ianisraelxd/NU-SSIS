import { useState } from 'react'
import { Async, Card, Field, Modal, PageHead, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/hooks.js'

// One small dialog for adding or renaming a department or a program.
function CodeNameDialog({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? { code: '', name: '' })
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Department code" htmlFor="cn-code" help="Short, e.g. CCIT">
          <input id="cn-code" className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Department name" htmlFor="cn-name">
          <input id="cn-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        {error && (
          <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
            {error}
          </p>
        )}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn">Save</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Departments() {
  const toast = useToast()
  const confirm = useConfirm()
  const state = useApi('/admin/departments')
  const [dialog, setDialog] = useState(null) // {kind:'dept'|'program', mode:'new'|'edit', item, departmentId}

  const done = (msg) => {
    toast(msg)
    setDialog(null)
    state.reload()
  }

  const save = async (form) => {
    const d = dialog
    if (d.kind === 'dept') {
      if (d.mode === 'new') await api.post('/admin/departments', form)
      else await api.put(`/admin/departments/${d.item.id}`, form)
      done(d.mode === 'new' ? 'Department added.' : 'Department updated.')
    } else {
      if (d.mode === 'new') await api.post('/admin/programs', { ...form, departmentId: d.departmentId })
      else await api.put(`/admin/programs/${d.item.id}`, form)
      done(d.mode === 'new' ? 'Program added.' : 'Program updated.')
    }
  }

  const remove = async (kind, item) => {
    const ok = await confirm({ title: `Delete ${item.code}?`, message: kind === 'dept' ? 'The department and its programs will be removed. This only works if no student or staff member belongs to it.' : 'The program will be removed from the list.', confirmLabel: 'Delete' })
    if (!ok) return
    try {
      await api.delete(`/admin/${kind === 'dept' ? 'departments' : 'programs'}/${item.id}`)
      toast('Deleted.')
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHead title="Departments & Programs" subtitle="The colleges and degree programs students and staff belong to.">
        <button className="btn" onClick={() => setDialog({ kind: 'dept', mode: 'new' })}>
          + Add department
        </button>
      </PageHead>
      <Async state={state}>
        {({ departments }) => (
          <div className="stack">
            {departments.map((d) => (
              <Card key={d.id}>
                <div className="card-head">
                  <div>
                    <h2>
                      {d.code} <span style={{ fontWeight: 500, fontSize: 16 }}>· {d.name}</span>
                    </h2>
                    <p className="sub">
                      {d.students} student{d.students === 1 ? '' : 's'} · {d.staff} staff
                    </p>
                  </div>
                  <div className="actions">
                    <button className="btn small secondary" onClick={() => setDialog({ kind: 'dept', mode: 'edit', item: d })}>
                      Edit
                    </button>
                    <button className="btn small danger" onClick={() => remove('dept', d)}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="serving-now">
                  {d.programs.length === 0 && <span className="muted">No programs yet</span>}
                  {d.programs.map((p) => (
                    <span key={p.id} className="chip" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <b>{p.code}</b> {p.name}
                      <button className="link-btn" aria-label={`Edit ${p.code}`} onClick={() => setDialog({ kind: 'program', mode: 'edit', item: p })}>
                        edit
                      </button>
                      <button className="link-btn" aria-label={`Delete ${p.code}`} style={{ color: 'var(--bad)' }} onClick={() => remove('program', p)}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <button className="btn small secondary" onClick={() => setDialog({ kind: 'program', mode: 'new', departmentId: d.id })}>
                  + Add program
                </button>
              </Card>
            ))}
          </div>
        )}
      </Async>
      {dialog && (
        <CodeNameDialog
          title={`${dialog.mode === 'new' ? 'Add' : 'Edit'} ${dialog.kind === 'dept' ? 'department' : 'program'}`}
          initial={dialog.item ? { code: dialog.item.code, name: dialog.item.name } : null}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
