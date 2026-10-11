import { useState } from 'react'
import { Async, Badge, Card, Field, PageHead, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { useApi } from '../../lib/hooks.js'

function Values({ settings, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState(() => Object.fromEntries(settings.map((s) => [s.key, s.value])))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = settings.some((s) => values[s.key] !== s.value)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await api.put('/admin/settings', { values })
      toast(res.changed ? 'Settings saved.' : 'Nothing changed.')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} noValidate>
      {settings.map((s) => (
        <Field key={s.key} label={s.label} htmlFor={`set-${s.key}`} help={`${s.hint} · default ${s.default}`}>
          <input id={`set-${s.key}`} className="input" type={s.type === 'number' ? 'number' : 'text'} value={values[s.key]} onChange={(e) => setValues({ ...values, [s.key]: e.target.value })} style={{ maxWidth: 420 }} />
        </Field>
      ))}
      {error && (
        <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>
          {error}
        </p>
      )}
      <button className="btn" disabled={!dirty || busy}>
        Save settings
      </button>
    </form>
  )
}

function Terms() {
  const toast = useToast()
  const state = useApi('/admin/terms')
  const [term, setTerm] = useState({ schoolYear: '', semester: 'First Semester' })

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
    <Card title="Academic year & semester" sub="The current term drives every student’s subjects, schedule and balance.">
      <Async state={state}>
        {({ terms }) => (
          <div className="stack" style={{ gap: 18 }}>
            <div className="serving-now">
              {terms.map((t) => (
                <span key={t.id} className="chip" style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                  {t.label}
                  {t.isCurrent ? (
                    <Badge status="Active">Current</Badge>
                  ) : (
                    <button className="link-btn" onClick={() => run(() => api.put('/admin/terms/current', { termId: t.id }), 'Current term changed.')}>
                      make current
                    </button>
                  )}
                </span>
              ))}
            </div>
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault()
                run(() => api.post('/admin/terms', term), 'Term added.').then(() => setTerm((t) => ({ ...t, schoolYear: '' })))
              }}
            >
              <input className="input" aria-label="School year" placeholder="School year, e.g. 2027-2028" value={term.schoolYear} onChange={(e) => setTerm({ ...term, schoolYear: e.target.value })} />
              <select className="select" aria-label="Semester" value={term.semester} onChange={(e) => setTerm({ ...term, semester: e.target.value })}>
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
              </select>
              <button className="btn secondary">Add term</button>
            </form>
          </div>
        )}
      </Async>
    </Card>
  )
}

export default function SystemSettings() {
  const state = useApi('/admin/settings')
  return (
    <>
      <PageHead title="System Settings" subtitle="Rules the whole system follows. Changes are recorded in the audit log." />
      <div className="stack" style={{ maxWidth: 900 }}>
        <Card title="General rules">
          <Async state={state}>{({ settings }) => <Values key={settings.map((s) => s.value).join('|')} settings={settings} onSaved={state.reload} />}</Async>
        </Card>
        <Terms />
      </div>
    </>
  )
}
