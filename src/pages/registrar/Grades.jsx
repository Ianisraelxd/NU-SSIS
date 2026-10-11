import { useState } from 'react'
import { Async, Badge, Card, PageHead, Table, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'
import { point } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function GradeSheet({ subjectId }) {
  const state = useApi(`/registrar/grades?subjectId=${subjectId}`)
  const toast = useToast()
  const [edits, setEdits] = useState({}) // `${studentId}:${field}` -> text
  const [busy, setBusy] = useState(false)

  const value = (row, field) => edits[`${row.studentId}:${field}`] ?? (row[field] == null ? '' : String(row[field]))
  const dirty = Object.keys(edits).length > 0

  const save = async (rows, event) => {
    const target = event.currentTarget
    setBusy(true)
    try {
      const grades = rows.map((r) => ({ studentId: r.studentId, prelim: value(r, 'prelim'), midterm: value(r, 'midterm'), finals: value(r, 'finals') }))
      const res = await api.put('/registrar/grades', { subjectId, grades })
      if (res.changed) burst(target, 16)
      toast(res.changed ? `Saved grades for ${res.changed} student${res.changed === 1 ? '' : 's'}.` : 'No changes to save.')
      setEdits({})
      state.reload()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Async state={state}>
      {(d) => (
        <Card
          flush
          title={`${d.subject.code} · ${d.subject.description}`}
          actions={
            <button className="btn" disabled={!dirty || busy} onClick={(e) => save(d.rows, e)}>
              Save grades
            </button>
          }
        >
          <Table
            rowKey="studentId"
            empty="No students are enrolled in this subject."
            columns={[
              { key: 'studentNo', label: 'Student no.', render: (r) => <span className="mono">{r.studentNo}</span> },
              { key: 'name', label: 'Name', render: (r) => <b>{r.name}</b> },
              ...['prelim', 'midterm', 'finals'].map((f) => ({
                key: f,
                label: f[0].toUpperCase() + f.slice(1),
                align: 'center',
                render: (r) => (
                  <input
                    className="input grade-input"
                    inputMode="decimal"
                    aria-label={`${r.name} ${f}`}
                    value={value(r, f)}
                    onChange={(e) => setEdits((s) => ({ ...s, [`${r.studentId}:${f}`]: e.target.value }))}
                  />
                ),
              })),
              { key: 'point', label: 'Final', align: 'center', render: (r) => (r.final == null ? '—' : `${r.final.toFixed(2)} (${point(r.point)})`) },
              { key: 'remark', label: 'Remarks', render: (r) => <Badge status={r.remark} /> },
            ]}
            rows={d.rows}
          />
        </Card>
      )}
    </Async>
  )
}

export default function Grades() {
  const subjects = useApi('/registrar/grades/subjects')
  const [subjectId, setSubjectId] = useState('')
  return (
    <>
      <PageHead title="Grades" subtitle="Enter and update Prelim, Midterm and Finals grades. Students are notified when their grades change." />
      <Async state={subjects}>
        {(d) => {
          const id = subjectId || String(d.subjects[0]?.id ?? '')
          return (
            <div className="stack">
              <div className="toolbar">
                <label className="sr-only" htmlFor="gr-subject">
                  Subject
                </label>
                <select id="gr-subject" className="select" value={id} onChange={(e) => setSubjectId(e.target.value)} style={{ minWidth: 340 }}>
                  {d.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.description} ({s.enrolled})
                    </option>
                  ))}
                </select>
                <span className="muted">{d.term}</span>
              </div>
              {id ? <GradeSheet key={id} subjectId={id} /> : <Card>No subjects have enrolled students yet.</Card>}
            </div>
          )
        }}
      </Async>
    </>
  )
}
