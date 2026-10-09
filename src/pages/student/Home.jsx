import { MegaphoneIcon } from '../../components/icons.jsx'
import { Async, Card, Stat } from '../../components/ui.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { DAYS, fmtDate, fmtMinutes, peso } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export function Announcements({ items }) {
  if (!items.length) return <Card>No announcements yet.</Card>
  return (
    <div className="stack">
      {items.map((a) => (
        <Card key={a.id} className="announcement">
          <h3>{a.title}</h3>
          <time dateTime={a.createdAt}>
            {fmtDate(a.createdAt)} · {a.author ?? 'Registrar'}
          </time>
          <p>{a.body}</p>
        </Card>
      ))}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const home = useApi('/student/home')
  const announcements = useApi('/announcements')

  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to <b>Student Information System</b> v1.0
        </h1>
        <p>National University Laguna Campus</p>
      </div>

      <Async state={home}>
        {(h) => {
          const n = h.nextClass
          return (
            <div className="grid stats">
              <Stat
                label="Next class"
                to="/schedule"
                value={n ? n.code : 'None'}
                hint={n ? `${n.today ? 'Today' : DAYS[n.day - 1]} · ${fmtMinutes(n.startMin)} · ${n.room}` : 'No classes scheduled'}
              />
              <Stat label="Pending tasks" to="/tasks" value={h.pendingTasks} tone={h.pendingTasks ? 'warn' : 'ok'} hint="Assignments to submit" />
              <Stat label="Balance" to="/account" value={peso(h.balance)} tone={h.balance ? 'warn' : 'ok'} hint="Remaining this term" />
              <Stat
                label="E-Clearance"
                to="/clearance"
                value={`${h.clearance.cleared} of ${h.clearance.total}`}
                tone={h.clearance.hold ? 'bad' : h.clearance.complete ? 'ok' : 'warn'}
                hint={h.clearance.hold ? 'Hold needs attention' : h.clearance.complete ? 'Complete' : 'Offices cleared'}
              />
            </div>
          )
        }}
      </Async>

      <h2 className="section-title">
        <MegaphoneIcon /> Announcements
      </h2>
      <Async state={announcements}>{(items) => <Announcements items={items} />}</Async>
      <span className="sr-only">Signed in as {user.name}</span>
    </div>
  )
}
