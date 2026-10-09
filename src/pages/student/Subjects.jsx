import { Async, Badge, Card, PageHead } from '../../components/ui.jsx'
import { DAYS, fmtMinutes, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function groupByInstructor(meetings) {
  const map = new Map()
  for (const m of meetings) map.set(m.instructor, [...(map.get(m.instructor) ?? []), m])
  return [...map.entries()]
}

export default function Subjects() {
  const state = useApi('/student/subjects')
  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="Subjects" subtitle={subtitle(d.yearLevel, d.term)}>
            <Badge tone="info">{d.subjects.reduce((n, s) => n + s.units, 0)} units</Badge>
          </PageHead>
          <div className="stack">
            {d.subjects.map((s) => (
              <Card key={s.id} className="subject-card">
                <h3>
                  {s.code} : {s.description} <Badge tone="muted">{s.units} units</Badge>
                </h3>
                <div className="meeting-groups">
                  {groupByInstructor(s.meetings).map(([instructor, list]) => (
                    <div key={instructor}>
                      <p className="who-teaches">{instructor}</p>
                      {list.map((m) => (
                        <p className="when" key={m.id}>
                          {DAYS[m.day - 1]}, {fmtMinutes(m.startMin)} – {fmtMinutes(m.endMin)} ({m.room})
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Async>
  )
}
