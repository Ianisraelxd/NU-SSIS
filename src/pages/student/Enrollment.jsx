import { CheckIcon } from '../../components/icons.jsx'
import { Async, Card, PageHead, Stat } from '../../components/ui.jsx'
import { subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const HINTS = [
  'Start with Registration at the Registrar’s Office.',
  'Meet your adviser to confirm the subjects you will take this term.',
  'The Cashier will assess your fees once your subjects are confirmed.',
  'Settle your fees at the Cashier. Check Account Summary for what is still due.',
  'You are officially enrolled. Have a great semester!',
]

export default function Enrollment() {
  const state = useApi('/student/enrollment')
  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="Enrollment Progress & Status" subtitle={subtitle(d.yearLevel, d.term)} />
          <div className="stack">
            <div className="grid stats">
              <Stat label="Status" value={d.status} tone={d.status === 'Enrolled' ? 'ok' : undefined} />
              <Stat label="Section" value={d.section} />
              <Stat label="Units enrolled" value={d.units} />
              <Stat label="Next step" value={d.nextStep} />
            </div>
            <Card title="Enrollment steps">
              <ol className="stepper">
                {d.steps.map((label, i) => {
                  const state = i < d.step ? 'done' : i === d.step ? 'current' : ''
                  return (
                    <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
                      <span className="dot">{state === 'done' && <CheckIcon width={16} height={16} />}</span>
                      {label}
                    </li>
                  )
                })}
              </ol>
              <p className="muted" style={{ marginTop: 22 }}>
                {HINTS[Math.min(d.step, HINTS.length - 1)]}
              </p>
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
