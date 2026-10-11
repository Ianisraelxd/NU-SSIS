import AnnouncementsManager from '../../components/AnnouncementsManager.jsx'
import { Async, Stat } from '../../components/ui.jsx'
import { useApi } from '../../lib/hooks.js'

export default function RegistrarHome() {
  const overview = useApi('/registrar/overview')
  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to <b>Registrar Information System</b> v1.0
        </h1>
        <p>National University Laguna Campus</p>
      </div>

      <Async state={overview}>
        {(o) => (
          <div className="grid stats">
            <Stat label="Requests to approve" to="/registrar/requests" value={o.pending} tone={o.pending ? 'warn' : 'ok'} hint={`${o.forPayment} awaiting payment`} />
            <Stat label="Enrollment to approve" to="/registrar/enrollment" value={o.enrollmentForApproval} tone={o.enrollmentForApproval ? 'warn' : 'ok'} />
            <Stat label="Waiting in queue" to="/registrar/queue" value={o.queueWaiting} hint="Registrar window today" />
            <Stat label="Ready for release" to="/registrar/requests" value={o.ready} hint={`${o.releasedToday} released today`} />
            <Stat label="Students on hold" to="/registrar/clearance" value={o.studentsOnHold} tone={o.studentsOnHold ? 'bad' : 'ok'} hint={`of ${o.students} students`} />
          </div>
        )}
      </Async>

      <AnnouncementsManager base="/registrar" />
    </div>
  )
}
