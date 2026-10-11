import { Link } from 'react-router-dom'
import { Async, Card, Stat } from '../../components/ui.jsx'
import { useApi } from '../../lib/hooks.js'

export default function DepartmentHome() {
  const o = useApi('/department/overview')
  return (
    <div className="stack">
      <Async state={o}>
        {(d) => (
          <>
            <div className="hero">
              <h1>
                Welcome to the <b>Department Module</b>
              </h1>
              <p>
                {d.department.code} · {d.department.name}
              </p>
            </div>
            <div className="grid stats">
              <Stat label="Students" to="/department/students" value={d.students} />
              <Stat label="Subjects to review" to="/department/enrollment" value={d.enrollmentForReview} tone={d.enrollmentForReview ? 'warn' : 'ok'} />
              <Stat label="Requirements to verify" to="/department/students" value={d.requirementsOpen} tone={d.requirementsOpen ? 'warn' : 'ok'} />
              <Stat label="Clearance to approve" to="/department/clearance" value={d.clearanceOpen} tone={d.clearanceOpen ? 'warn' : 'ok'} />
              <Stat label="Waiting in queue" to="/department/queue" value={d.queueWaiting} hint="Department window today" />
            </div>
            <Card title="What you can do here">
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                <li>
                  <Link to="/department/enrollment">Enrollment review</Link> — approve or return the subjects your students picked.
                </li>
                <li>
                  <Link to="/department/students">Students</Link> — verify academic requirements and view grades (every grade view is logged).
                </li>
                <li>
                  <Link to="/department/clearance">Clearance</Link> — approve or hold the department line of a student’s clearance.
                </li>
                <li>
                  <Link to="/department/queue">Queue Management</Link> — call the next student at the department window.
                </li>
              </ul>
            </Card>
          </>
        )}
      </Async>
    </div>
  )
}
