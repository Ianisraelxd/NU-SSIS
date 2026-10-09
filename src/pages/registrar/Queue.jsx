import { Async, Badge, Card, PageHead, Stat, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime, fmtShort } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import RequestActions from './RequestActions.jsx'

function Item({ r, position, onChange }) {
  return (
    <div className="queue-item">
      <div className="lead">
        {position != null && <span className="queue-pos" aria-label={`Position ${position}`}>{position}</span>}
        <div>
          <div className="title">
            {r.document}
            {r.copies > 1 ? ` ×${r.copies}` : ''} <span className="muted">· {r.requestNo}</span>
          </div>
          <div className="sub">
            {r.studentName} ({r.studentNo}) · filed {fmtDateTime(r.createdAt)} · pickup {fmtShort(r.pickupDate)}
          </div>
          {r.purpose && <div className="sub">Purpose: {r.purpose}</div>}
        </div>
      </div>
      <RequestActions request={r} onChange={onChange} compact />
    </div>
  )
}

export default function Queue() {
  const state = useApi('/registrar/queue')
  const toast = useToast()

  const callNext = async () => {
    try {
      const r = await api.post('/registrar/queue/next')
      toast(`Now serving ${r.requestNo} — ${r.studentName}`)
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <Async state={state}>
      {(q) => (
        <>
          <PageHead title="Queue Management" subtitle="Document requests are served first-come, first-served.">
            <button className="btn" onClick={callNext} disabled={q.waiting.length === 0}>
              Call next ({q.waiting.length} waiting)
            </button>
          </PageHead>
          <div className="stack">
            <div className="grid stats">
              <Stat label="Waiting" value={q.waiting.length} tone={q.waiting.length ? 'warn' : 'ok'} />
              <Stat label="Now processing" value={q.processing.length} />
              <Stat label="Ready for pickup" value={q.ready.length} />
            </div>

            <Card title="Now processing" sub="Requests you are working on" actions={<Badge tone="info">{q.processing.length}</Badge>}>
              <div className="queue-now">
                {q.processing.length === 0 && <p className="muted">Nothing in progress. Press “Call next” to start the next request.</p>}
                {q.processing.map((r) => (
                  <Item key={r.id} r={r} onChange={state.reload} />
                ))}
              </div>
            </Card>

            <Card title="Waiting" sub="Oldest first" actions={<Badge tone="warn">{q.waiting.length}</Badge>}>
              <div className="queue-now">
                {q.waiting.length === 0 && <p className="muted">The queue is empty. 🎉</p>}
                {q.waiting.map((r) => (
                  <Item key={r.id} r={r} position={r.position} onChange={state.reload} />
                ))}
              </div>
            </Card>

            <Card title="Ready for pickup" sub="Release once the student has collected the document" actions={<Badge tone="ok">{q.ready.length}</Badge>}>
              <div className="queue-now">
                {q.ready.length === 0 && <p className="muted">No documents waiting for pickup.</p>}
                {q.ready.map((r) => (
                  <Item key={r.id} r={r} onChange={state.reload} />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
