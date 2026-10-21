import { useState } from 'react'
import TempPassword from '../../components/TempPassword.jsx'
import { Async, Badge, Card, Field, Modal, PageHead, Table, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { ROLE_LABEL, fmtDate } from '../../lib/format.js'
import { useApi, useDebounced } from '../../lib/hooks.js'

const STAFF = ['registrar', 'cashier', 'department', 'admin']

function UserForm({ user, meta, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!user
  const [form, setForm] = useState(user ? { name: user.name, email: user.email ?? '', phone: user.phone ?? '', role: user.role, departmentId: user.departmentId ?? '' } : { loginId: '', name: '', email: '', phone: '', role: 'cashier', departmentId: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const canChangeRole = !editing || STAFF.includes(user.role)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = editing ? await api.patch(`/admin/users/${user.id}`, form) : await api.post('/admin/users', form)
      toast(editing ? 'Account updated.' : 'Account created.')
      onSaved(editing ? null : result)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? `Edit ${user.loginId}` : 'Create a staff account'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        {!editing && (
          <Field label="Login ID" htmlFor="u-id" help="Used to sign in, e.g. CSH-0002">
            <input id="u-id" className="input" value={form.loginId} onChange={set('loginId')} />
          </Field>
        )}
        <Field label="Full name" htmlFor="u-name">
          <input id="u-name" className="input" value={form.name} onChange={set('name')} />
        </Field>
        <div className="row">
          <Field label="Email" htmlFor="u-email">
            <input id="u-email" type="email" className="input" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Mobile number" htmlFor="u-phone">
            <input id="u-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
        <div className="row">
          <Field label="Account role" htmlFor="u-role" help={canChangeRole ? undefined : 'Student roles cannot be changed'}>
            <select id="u-role" className="select" value={form.role} onChange={set('role')} disabled={!canChangeRole}>
              {(canChangeRole ? STAFF : [form.role]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          {form.role === 'department' && (
            <Field label="Department" htmlFor="u-dept">
              <select id="u-dept" className="select" value={form.departmentId} onChange={set('departmentId')}>
                <option value="">— choose —</option>
                {meta.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
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
            {editing ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const toast = useToast()
  const confirm = useConfirm()
  const meta = useApi('/meta')
  const [filters, setFilters] = useState({ q: '', role: 'all', status: 'all' })
  const q = useDebounced(filters.q)
  const state = useApi(`/admin/users?${new URLSearchParams({ q, role: filters.role, status: filters.status })}`)
  const [form, setForm] = useState(null)
  const [secret, setSecret] = useState(null)
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))

  const run = async (fn, ok) => {
    try {
      const res = await fn()
      if (ok) toast(ok)
      state.reload()
      return res
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const toggle = async (u) => {
    if (u.active) {
      const ok = await confirm({ title: `Disable ${u.name}?`, message: 'They will be signed out and cannot sign in until you enable the account again.', confirmLabel: 'Disable account' })
      if (!ok) return
    }
    run(() => api.patch(`/admin/users/${u.id}`, { active: !u.active }), u.active ? 'Account disabled.' : 'Account enabled.')
  }

  const reset = async (u) => {
    const ok = await confirm({ title: `Reset ${u.name}’s password?`, message: 'A new temporary password will be generated and they will be signed out everywhere.', confirmLabel: 'Reset password', danger: false })
    if (!ok) return
    const res = await run(() => api.post(`/admin/users/${u.id}/reset-password`), 'Password reset.')
    if (res) setSecret({ loginId: res.loginId, password: res.tempPassword, title: 'Password reset' })
  }

  return (
    <>
      <PageHead title="User Accounts" subtitle="Create staff accounts, assign roles, disable access and reset passwords.">
        <button className="btn" onClick={() => setForm('new')} disabled={!meta.data}>
          + Create staff account
        </button>
      </PageHead>
      <div className="stack">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="u-q">
            Search accounts
          </label>
          <input id="u-q" className="input grow" placeholder="Search name, ID or email" value={filters.q} onChange={set('q')} />
          <label className="sr-only" htmlFor="u-r">
            Role
          </label>
          <select id="u-r" className="select" value={filters.role} onChange={set('role')}>
            <option value="all">All roles</option>
            {['student', ...STAFF].map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="u-s">
            Status
          </label>
          <select id="u-s" className="select" value={filters.status} onChange={set('status')}>
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <Async state={state}>
          {({ users }) => (
            <Card flush title={`${users.length} account${users.length === 1 ? '' : 's'}`}>
              <Table
                empty="No accounts match."
                columns={[
                  { key: 'loginId', label: 'Login ID', render: (u) => <span className="mono">{u.loginId}</span> },
                  {
                    key: 'name',
                    label: 'Full name',
                    render: (u) => (
                      <>
                        <b>{u.name}</b>
                        <br />
                        <span className="muted">{u.email ?? '—'}</span>
                      </>
                    ),
                  },
                  { key: 'role', label: 'Account role', render: (u) => `${ROLE_LABEL[u.role]}${u.deptCode ? ` · ${u.deptCode}` : ''}` },
                  { key: 'createdAt', label: 'Date created', render: (u) => fmtDate(u.createdAt) },
                  { key: 'status', label: 'Account status', render: (u) => (!u.active ? <Badge status="Disabled" /> : u.locked ? <Badge status="Locked" /> : <Badge status="Active" />) },
                  {
                    key: 'x',
                    label: 'Actions',
                    render: (u) => (
                      <div className="actions">
                        <button className="btn small secondary" onClick={() => setForm(u)}>
                          Edit
                        </button>
                        <button className="btn small secondary" onClick={() => reset(u)}>
                          Reset password
                        </button>
                        {u.locked && (
                          <button className="btn small" onClick={() => run(() => api.patch(`/admin/users/${u.id}`, { unlock: true }), 'Account unlocked.')}>
                            Unlock
                          </button>
                        )}
                        <button className={`btn small ${u.active ? 'danger' : ''}`} onClick={() => toggle(u)}>
                          {u.active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    ),
                  },
                ]}
                rows={users}
              />
            </Card>
          )}
        </Async>
      </div>
      {form && meta.data && (
        <UserForm
          user={form === 'new' ? null : form}
          meta={meta.data}
          onClose={() => setForm(null)}
          onSaved={(created) => {
            setForm(null)
            state.reload()
            if (created) setSecret({ loginId: created.loginId, password: created.tempPassword, title: 'Account created' })
          }}
        />
      )}
      {secret && <TempPassword title={secret.title} loginId={secret.loginId} password={secret.password} onClose={() => setSecret(null)} />}
    </>
  )
}
