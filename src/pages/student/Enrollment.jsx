import { useState } from 'react'
import { CheckIcon } from '../../components/icons.jsx'
import { Async, Badge, Card, PageHead, Stat, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const hint = (d) =>
  [
    'Pick your subjects below and submit them for department review.',
    'Your department is reviewing your subjects. You will be notified when they decide.',
    'The Registrar is verifying your records and approving your enrollment.',
    `Pay at the Cashier. Enrollment is confirmed once at least ${d.payment.minPercent}% of your assessment is paid — you are at ${d.payment.percent}%.`,
    '',
    'You are officially enrolled. Have a great semester!',
  ][d.step]

export default function Enrollment() {
  const state = useApi('/student/enrollment')
  const toast = useToast()
  const [picked, setPicked] = useState(null) // null = what the server has saved
  const [busy, setBusy] = useState(false)

  const save = async (d, selected, submit, event) => {
    const target = event.currentTarget
    setBusy(true)
    try {
      await api.put('/student/enrollment', { subjectIds: selected, submit })
      if (submit) burst(target)
      toast(submit ? 'Submitted for department review.' : 'Draft saved.')
      setPicked(null)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Async state={state}>
      {(d) => {
        const selected = picked ?? d.selected
        const units = d.available.filter((s) => selected.includes(s.id)).reduce((n, s) => n + s.units, 0)
        const over = units > d.maxUnits
        const toggle = (id) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
        const chosen = d.available.filter((s) => d.selected.includes(s.id))
        return (
          <>
            <PageHead title="Enrollment Progress & Status" subtitle={subtitle(d.yearLevel, d.term)} />
            <div className="stack">
              <div className="grid stats">
                <Stat label="Status" value={d.status} tone={d.status === 'Enrolled' ? 'ok' : d.status === 'Returned' ? 'bad' : undefined} />
                <Stat label="Section" value={d.section} />
                <Stat label="Units" value={d.units} hint={`of ${d.maxUnits} allowed`} />
                <Stat label="Next step" value={d.nextStep} />
              </div>

              {d.status === 'Returned' && d.request?.remarks && (
                <div className="alert bad">
                  <div>
                    <strong>Returned for changes.</strong> {d.request.remarks}
                  </div>
                </div>
              )}

              <Card title="Enrollment steps">
                <ol className="stepper">
                  {d.steps.map((label, i) => {
                    const s = i < d.step ? 'done' : i === d.step ? 'current' : ''
                    return (
                      <li key={label} style={{ '--i': i }} className={s} aria-current={s === 'current' ? 'step' : undefined}>
                        <span className="dot">{s === 'done' && <CheckIcon width={16} height={16} />}</span>
                        {label}
                      </li>
                    )
                  })}
                </ol>
                <p className="muted" style={{ marginTop: 22 }}>
                  {hint(d)}
                </p>
                {d.step === 3 && (
                  <div className="progress-row" style={{ marginTop: 14 }}>
                    <span>Paid</span>
                    <div className="bar" role="progressbar" aria-valuenow={d.payment.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Share of assessment paid">
                      <span style={{ width: `${Math.min(d.payment.percent, 100)}%` }} />
                    </div>
                    <b>{d.payment.percent}%</b>
                  </div>
                )}
              </Card>

              {d.canEdit ? (
                <>
                  <Card title="Select your subjects" sub={`Subjects open for your program this term. You can take up to ${d.maxUnits} units.`}>
                    <div className="subject-pick">
                      {d.available.map((s) => (
                        <label key={s.id} className={`pick ${selected.includes(s.id) ? 'on' : ''}`}>
                          <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                          <div>
                            <b>{s.code}</b>
                            <span>
                              {s.description} · {s.units} unit{s.units === 1 ? '' : 's'}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </Card>
                  <div className="units-meter">
                    <div>
                      <b style={{ fontSize: 20, color: over ? 'var(--bad)' : undefined }}>{units}</b> <span className="muted">of {d.maxUnits} units · {selected.length} subject{selected.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="actions">
                      <button className="btn secondary" disabled={busy || over} onClick={(e) => save(d, selected, false, e)}>
                        Save draft
                      </button>
                      <button className="btn" disabled={busy || over || selected.length === 0} onClick={(e) => save(d, selected, true, e)}>
                        Submit for review
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <Card title="Your subjects" sub={`Status: ${d.request?.status ?? '—'}`}>
                  {chosen.length === 0 ? (
                    <p className="muted">No subjects on this request.</p>
                  ) : (
                    <div className="subject-pick">
                      {chosen.map((s) => (
                        <div key={s.id} className="pick on">
                          <div>
                            <b>{s.code}</b>
                            <span>
                              {s.description} · {s.units} unit{s.units === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {d.status !== 'Enrolled' && d.request?.status !== 'Approved' && (
                    <p style={{ marginTop: 14 }}>
                      <Badge status={d.request?.status ?? 'Pending'} /> Your subjects are locked while they are being reviewed.
                    </p>
                  )}
                </Card>
              )}
            </div>
          </>
        )
      }}
    </Async>
  )
}
