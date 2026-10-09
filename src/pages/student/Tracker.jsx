import { Async, Badge, Card, PageHead, Stat, Table } from '../../components/ui.jsx'
import { point, subtitle, yearName } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function Tracker() {
  const state = useApi('/student/tracker')
  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="Academic Tracker" subtitle={subtitle(d.yearLevel, d.term)} />
          <div className="stack">
            <div className="grid stats">
              <Stat label="GWA" value={d.gwa == null ? '—' : d.gwa.toFixed(2)} hint="General weighted average (lower is better)" />
              <Stat label="Units earned" value={d.unitsEarned} />
              <Stat label="Units remaining" value={d.unitsRemaining} />
              <Stat label="Standing" value={d.standing} tone={d.standing === 'Regular' ? 'ok' : 'warn'} />
            </div>

            <Card title="Progress per year level">
              {d.progress.map((p, i) => (
                <div className="progress-row" key={p.year}>
                  <span>{yearName(p.year).replace(' Year', '')} Year</span>
                  <div
                    className="bar"
                    role="progressbar"
                    aria-valuenow={p.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${yearName(p.year)} progress`}
                  >
                    <span style={{ width: `${p.percent}%`, "--i": i }} />
                  </div>
                  <b>{p.percent}%</b>
                </div>
              ))}
            </Card>

            <Card title="Current subjects" flush>
              <Table
                rowKey="code"
                columns={[
                  { key: 'subject', label: 'Subject', render: (s) => `${s.code} : ${s.description}` },
                  { key: 'units', label: 'Units', align: 'center' },
                  {
                    key: 'average',
                    label: 'Current average',
                    align: 'center',
                    render: (s) => (s.average == null ? '—' : `${s.average.toFixed(2)} (${point(s.point)})`),
                  },
                  { key: 'status', label: 'Status', render: (s) => <Badge status={s.status} /> },
                ]}
                rows={d.subjects}
              />
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
