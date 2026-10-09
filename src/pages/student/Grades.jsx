import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table } from '../../components/ui.jsx'
import { point, subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

const dash = (v) => (v == null ? '--' : v.toFixed(2))

export default function Grades() {
  const [termId, setTermId] = useState('')
  const state = useApi(`/student/grades${termId ? `?term=${termId}` : ''}`)

  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="Grades per Semester" subtitle={subtitle(d.yearLevel, d.term.label)} />
          <div className="stack">
            <div className="toolbar">
              <label className="sr-only" htmlFor="term">
                Semester
              </label>
              <select id="term" className="select" value={d.term.id} onChange={(e) => setTermId(e.target.value)} style={{ minWidth: 300 }}>
                {d.terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label.replace('A.Y. ', 'A.Y ')}
                  </option>
                ))}
              </select>
              {d.semesterGwa != null && <Badge tone="info">Semester GWA {d.semesterGwa.toFixed(2)}</Badge>}
            </div>

            <Card title={d.term.label.replace(/^A\.Y\. (.+), (.+)$/, '$2 A.Y. $1')} flush>
              <Table
                rowKey="code"
                columns={[
                  { key: 'code', label: 'Course code', render: (r) => <b>{r.code}</b> },
                  { key: 'description', label: 'Course description' },
                  { key: 'units', label: 'Units', align: 'center' },
                  { key: 'prelim', label: 'Prelim', align: 'center', render: (r) => dash(r.prelim) },
                  { key: 'midterm', label: 'Midterm', align: 'center', render: (r) => dash(r.midterm) },
                  { key: 'finals', label: 'Finals', align: 'center', render: (r) => dash(r.finals) },
                  { key: 'final', label: 'Final grade', align: 'center', render: (r) => (r.final == null ? '--' : <b>{point(r.point)}</b>) },
                  { key: 'remark', label: 'Remarks', render: (r) => <Badge status={r.remark} /> },
                ]}
                rows={d.rows}
              />
            </Card>

            <div className="grid two">
              <Card title="Grade range" flush>
                <Table
                  rowKey="min"
                  columns={[
                    { key: 'range', label: 'Grade range', render: (s) => `${s.max} – ${s.min}` },
                    { key: 'point', label: 'Point grade', align: 'center', render: (s) => s.point.toFixed(2) },
                    { key: 'remark', label: 'Remarks', render: (s) => <Badge status={s.remark} /> },
                  ]}
                  rows={d.scale}
                />
              </Card>
              <Card title="Grading policy">
                <p>
                  Your final grade is the average of the Prelim, Midterm and Finals grades, converted to a point grade using the
                  table beside this one. A final grade is shown only after all three grading periods have been posted.
                </p>
                <p style={{ marginTop: 12 }}>
                  A point grade of 3.00 is the lowest passing mark. Grades below 60 are marked <b>Failed</b>; the subject must
                  be retaken. An <b>INC</b> (incomplete) must be completed within one semester or it converts to a failing
                  grade.
                </p>
                <p style={{ marginTop: 12 }} className="muted">
                  Questions about a grade? Talk to your instructor first, then the Registrar’s Office.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </Async>
  )
}
