import { DAYS, fmtMinutes } from '../lib/format.js'

// The weekly class times a student's chosen subjects would give them, with any clash called out.
// Shown to the Department and Registrar before they approve, so a schedule with a conflict is never offered.
export default function ScheduleReview({ schedule = [], conflicts = [] }) {
  return (
    <div className="schedule-review">
      <h3>Student’s class schedule</h3>
      {conflicts.length > 0 && (
        <div className="alert bad" role="alert">
          <div>
            <strong>Schedule conflict — this cannot be approved.</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <span>Return the subjects to the student so they can choose a different combination.</span>
          </div>
        </div>
      )}
      {schedule.length === 0 ? (
        <p className="muted">None of these subjects has class times yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Class time</th>
                <th>Subject</th>
                <th>Room</th>
                <th>Instructor</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((m, i) => {
                const clash = conflicts.some((c) => c.includes(m.code))
                return (
                  <tr key={`${m.subjectId}-${i}`} className={clash ? 'row-clash' : undefined}>
                    <td>{DAYS[m.day - 1]}</td>
                    <td>
                      {fmtMinutes(m.startMin)} – {fmtMinutes(m.endMin)}
                    </td>
                    <td>
                      <b>{m.code}</b> <span className="muted">{m.description}</span>
                    </td>
                    <td>{m.room}</td>
                    <td>{m.instructor}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
