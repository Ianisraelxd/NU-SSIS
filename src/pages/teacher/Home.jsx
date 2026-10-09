import { Link } from 'react-router-dom'
import { Async, Badge, Card, Stat } from '../../components/ui.jsx'
import { fmtDateTime } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'
import { useRealtimeEvents } from '../../lib/realtime.jsx'

export default function TeacherHome() {
  const home = useApi('/teacher/home')
  useRealtimeEvents((ev) => {
    if (['message', 'unread'].includes(ev.type)) home.reload()
  })

  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to the <b>Faculty Portal</b> v1.0
        </h1>
        <p>National University Laguna Campus</p>
      </div>

      <Async state={home}>
        {(h) => (
          <>
            <div className="grid stats">
              <Stat label="Activities posted" to="/teacher/activities" value={h.activities} hint={h.term} />
              <Stat label="Subjects" value={h.subjects} />
              <Stat label="Students" value={h.students} />
              <Stat label="Unread comments" to="/teacher/messages" value={h.unread} tone={h.unread ? 'warn' : 'ok'} hint={h.unread ? 'Students are waiting for a reply' : 'All caught up'} />
            </div>
            <Card title="Upcoming deadlines" sub="Open an activity to see who has finished and read their comments" flush>
              {h.upcoming.length === 0 && <p className="empty">No upcoming activities. Post one from the Activities page.</p>}
              <div className="upcoming">
                {h.upcoming.map((a) => (
                  <Link key={a.id} to={`/teacher/activities/${a.id}`} className="upcoming-row">
                    <div>
                      <b>{a.title}</b>
                      <span className="muted">
                        {a.code} · due {fmtDateTime(a.dueAt)}
                      </span>
                    </div>
                    <div className="upcoming-side">
                      <span className="muted">
                        {a.done}/{a.students} done
                      </span>
                      {a.unread > 0 && <Badge tone="bad">{a.unread} new</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
      </Async>
    </div>
  )
}
