import { useState } from 'react'
import { Async, Card, Field, PageHead, useToast } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { useApi } from '../lib/hooks.js'

function Profile() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ name: user.name, email: user.email ?? '', phone: user.phone ?? '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.put('/settings/profile', form)
      setUser(res.user)
      toast('Profile saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Profile" sub="Your contact details used for school notices.">
      <form onSubmit={save} noValidate>
        <div className="row">
          <Field label={user.role === 'student' ? 'Student number' : 'Employee ID'} htmlFor="s-id" help="Assigned by the school — can’t be changed.">
            <input id="s-id" className="input" value={user.loginId} disabled />
          </Field>
          <Field label="Full name" htmlFor="s-name">
            <input id="s-name" className="input" value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
        </div>
        <div className="row">
          <Field label="Email" htmlFor="s-email">
            <input id="s-email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Mobile number" htmlFor="s-phone">
            <input id="s-phone" type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </Field>
        </div>
        {error && <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{error}</p>}
        <button className="btn" disabled={busy}>
          Save profile
        </button>
      </form>
    </Card>
  )
}

function Preferences() {
  const { user, theme, savePreferences } = useAuth()
  const toast = useToast()
  const [prefs, setPrefs] = useState({ notifyInapp: user.notifyInapp, notifyEmail: user.notifyEmail })

  const save = async (next) => {
    try {
      await savePreferences({ theme, ...prefs, ...next })
      toast('Preferences saved.')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <Card title="Appearance" sub="Pick the look that is easiest on your eyes.">
        <div className="segmented" role="group" aria-label="Theme">
          {['light', 'dark'].map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => theme !== t && save({ theme: t })}>
              {t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Notifications">
        <label className="switch">
          <div>
            <b>In-app notifications</b>
            <p>Bell alerts for request updates, clearance changes and announcements.</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifyInapp}
            onChange={(e) => {
              setPrefs({ ...prefs, notifyInapp: e.target.checked })
              save({ notifyInapp: e.target.checked })
            }}
          />
        </label>
        <label className="switch">
          <div>
            <b>Email me too</b>
            <p>Send a copy of important notices to your email address.</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifyEmail}
            onChange={(e) => {
              setPrefs({ ...prefs, notifyEmail: e.target.checked })
              save({ notifyEmail: e.target.checked })
            }}
          />
        </label>
      </Card>
    </>
  )
}

function Security() {
  const toast = useToast()
  const empty = { current: '', next: '', confirm: '' }
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (form.next.length < 8) return setError('New password must be at least 8 characters.')
    if (form.next !== form.confirm) return setError('The new passwords don’t match.')
    setBusy(true)
    try {
      await api.post('/settings/password', { current: form.current, next: form.next })
      toast('Password changed. Other devices were signed out.')
      setForm(empty)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Security" sub="Change your password. Other devices will be signed out.">
      <form onSubmit={save} noValidate style={{ maxWidth: 440 }}>
        <Field label="Current password" htmlFor="pw-cur">
          <input id="pw-cur" type="password" className="input" value={form.current} onChange={set('current')} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="pw-new" help="At least 8 characters.">
          <input id="pw-new" type="password" className="input" value={form.next} onChange={set('next')} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-conf">
          <input id="pw-conf" type="password" className="input" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
        </Field>
        {error && <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{error}</p>}
        <button className="btn" disabled={busy}>
          Change password
        </button>
      </form>
    </Card>
  )
}

function RegistrarConfig() {
  const toast = useToast()
  const state = useApi('/registrar/config')
  const [newTerm, setNewTerm] = useState({ schoolYear: '', semester: 'First Semester' })
  const [fees, setFees] = useState({})

  const run = async (fn, ok) => {
    try {
      await fn()
      toast(ok)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {(d) => (
        <>
          <Card title="Academic term" sub="The current term drives every student’s subjects, schedule and balance.">
            <Field label="Current term" htmlFor="term-cur">
              <select
                id="term-cur"
                className="select"
                value={d.terms.find((t) => t.isCurrent)?.id}
                onChange={(e) => run(() => api.put('/registrar/config/term', { termId: Number(e.target.value) }), 'Current term updated.')}
              >
                {d.terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="toolbar">
              <input
                className="input"
                aria-label="School year"
                placeholder="School year, e.g. 2027-2028"
                value={newTerm.schoolYear}
                onChange={(e) => setNewTerm({ ...newTerm, schoolYear: e.target.value })}
              />
              <select className="select" aria-label="Semester" value={newTerm.semester} onChange={(e) => setNewTerm({ ...newTerm, semester: e.target.value })}>
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
              </select>
              <button
                className="btn secondary"
                onClick={() => run(async () => { await api.post('/registrar/config/terms', newTerm); setNewTerm({ ...newTerm, schoolYear: '' }) }, 'Term added.')}
              >
                Add term
              </button>
            </div>
          </Card>

          <Card title="Document fees" sub="Fee per copy. “Needs clearance” documents are locked until a student’s E-Clearance is complete.">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Fee (₱)</th>
                    <th>Needs clearance</th>
                    <th>Available</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.docTypes.map((t) => {
                    const v = fees[t.id] ?? { fee: t.fee, requiresClearance: t.requiresClearance, active: t.active }
                    const set = (patch) => setFees({ ...fees, [t.id]: { ...v, ...patch } })
                    const dirty = v.fee !== t.fee || v.requiresClearance !== t.requiresClearance || v.active !== t.active
                    return (
                      <tr key={t.id}>
                        <td>
                          <b>{t.name}</b>
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            aria-label={`${t.name} fee`}
                            style={{ width: 120 }}
                            value={v.fee}
                            onChange={(e) => set({ fee: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input type="checkbox" aria-label={`${t.name} needs clearance`} checked={v.requiresClearance} onChange={(e) => set({ requiresClearance: e.target.checked })} />
                        </td>
                        <td>
                          <input type="checkbox" aria-label={`${t.name} available`} checked={v.active} onChange={(e) => set({ active: e.target.checked })} />
                        </td>
                        <td>
                          <button
                            className="btn small"
                            disabled={!dirty}
                            onClick={() =>
                              run(async () => {
                                await api.put(`/registrar/config/doc-types/${t.id}`, v)
                                setFees((all) => Object.fromEntries(Object.entries(all).filter(([k]) => Number(k) !== t.id)))
                              }, `${t.name} saved.`)
                            }
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </Async>
  )
}

export default function Settings() {
  const { user } = useAuth()
  return (
    <>
      <PageHead title="Settings" subtitle="Manage your account and preferences." />
      <div className="stack" style={{ maxWidth: 900 }}>
        <Profile />
        <Preferences />
        <Security />
        {user.role === 'registrar' && <RegistrarConfig />}
      </div>
    </>
  )
}
