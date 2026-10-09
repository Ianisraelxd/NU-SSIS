import { useState } from 'react'
import { Async, Card, PageHead } from '../../components/ui.jsx'
import { DAYS, fmtMinutes, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const COLORS = ['#1d4ed8', '#0f766e', '#15803d', '#6d28d9', '#a16207', '#be185d', '#475569']
const FIRST = 7 * 60
const LAST = 20 * 60
const HOUR = 58

export default function Schedule() {
  const state = useApi('/student/schedule')
  const [todayIdx] = useState(() => new Date().getDay()) // 1..5 = Mon..Fri

  return (
    <Async state={state}>
      {(d) => {
        const codes = [...new Set(d.meetings.map((m) => m.code))]
        const hours = []
        for (let t = FIRST; t <= LAST; t += 60) hours.push(t)
        return (
          <>
            <PageHead title="Schedule" subtitle={subtitle(d.yearLevel, d.term)} />
            <Card flush>
              <div className="table-wrap">
                <div className="sched" style={{ '--hour': `${HOUR}px` }}>
                  <div className="corner" />
                  {DAYS.slice(0, 5).map((day, i) => (
                    <div key={day} className={`day-head ${todayIdx === i + 1 ? 'today' : ''}`}>
                      {day.slice(0, 3)}
                    </div>
                  ))}
                  <div className="times" style={{ height: (hours.length - 1) * HOUR + 14 }}>
                    {hours.map((t) => (
                      <span key={t} style={{ top: ((t - FIRST) / 60) * HOUR }}>
                        {fmtMinutes(t).replace(':00', '')}
                      </span>
                    ))}
                  </div>
                  {[1, 2, 3, 4, 5].map((day) => (
                    <div key={day} className="col" style={{ height: (hours.length - 1) * HOUR + 14 }}>
                      {d.meetings
                        .filter((m) => m.day === day)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="block"
                            style={{
                              top: ((m.startMin - FIRST) / 60) * HOUR,
                              height: ((m.endMin - m.startMin) / 60) * HOUR - 3,
                              background: COLORS[codes.indexOf(m.code) % COLORS.length],
                            }}
                            title={`${m.code} ${m.description} — ${m.instructor}`}
                          >
                            <b>{m.code}</b>
                            {m.description}
                            <br />
                            {fmtMinutes(m.startMin)} · {m.room}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <div className="legend" style={{ marginTop: 16 }}>
              {codes.map((c, i) => (
                <span key={c}>
                  <i style={{ background: COLORS[i % COLORS.length] }} />
                  {c}
                </span>
              ))}
            </div>
          </>
        )
      }}
    </Async>
  )
}
