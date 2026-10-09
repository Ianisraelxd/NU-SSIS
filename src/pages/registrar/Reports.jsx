import { useEffect, useState } from 'react'
import { Card, ErrorState, Loading, PageHead, Stat, StackedBars, Table } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtDateTime } from '../../lib/format.js'

const PERIODS = [
  ['today', 'Today'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['all', 'All time'],
]
const TYPES = [
  ['documents', 'Document Request Report'],
  ['clearance', 'Clearance Report'],
  ['enrollment', 'Enrollment Report'],
]

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`

function downloadCsv(report) {
  const lines = [
    [`${TYPES.find(([k]) => k === report.type)?.[1]} — generated ${fmtDateTime(report.generatedAt)}`],
    [],
    ...report.stats.map((s) => [s.label, s.value]),
    [],
    [report.chart.title, ...report.chart.series, 'Total'],
    ...report.chart.rows.map((r) => [r.label, r.a, r.b, r.a + r.b]),
    ...(report.table ? [[], report.table.columns, ...report.table.rows] : []),
  ]
  const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${report.type}-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Reports() {
  const [draft, setDraft] = useState({ type: 'documents', period: 'week' })
  const [applied, setApplied] = useState(draft)
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let cancelled = false
    api
      .get(`/registrar/reports?type=${applied.type}&period=${applied.period}`)
      .then((data) => !cancelled && setState({ loading: false, data, error: null }))
      .catch((error) => !cancelled && setState({ loading: false, data: null, error }))
    return () => {
      cancelled = true
    }
  }, [applied])

  const generate = () => {
    setState((s) => ({ ...s, loading: true }))
    setApplied({ ...draft })
  }

  const { data, loading, error } = state
  const periodLabel = PERIODS.find(([k]) => k === (data?.period ?? applied.period))?.[1]

  return (
    <>
      <PageHead title="Reports" subtitle="Generate, print or export registrar activity." />
      <div className="stack">
        <div className="toolbar no-print">
          <label className="sr-only" htmlFor="rp-period">
            Period
          </label>
          <select
            id="rp-period"
            className="select"
            value={draft.period}
            disabled={draft.type !== 'documents'}
            onChange={(e) => setDraft({ ...draft, period: e.target.value })}
          >
            {PERIODS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="rp-type">
            Report type
          </label>
          <select id="rp-type" className="select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {TYPES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {data && (
            <>
              <button className="btn secondary" onClick={() => downloadCsv(data)}>
                Export CSV
              </button>
              <button className="btn secondary" onClick={() => window.print()}>
                Print
              </button>
            </>
          )}
        </div>

        {loading && !data && <Loading />}
        {error && <ErrorState error={error} />}
        {data && (
          <div className="stack" style={{ opacity: loading ? 0.5 : 1 }}>
            <p className="muted">
              {TYPES.find(([k]) => k === data.type)?.[1]}
              {data.type === 'documents' ? ` · ${periodLabel}` : ''} · generated {fmtDateTime(data.generatedAt)}
            </p>
            <div className="grid stats">
              {data.stats.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <Card
              title={data.chart.title}
              sub={data.type === 'documents' ? `${periodLabel} · ${data.stats[0].value} total (${data.stats[1].value} released, ${data.stats[2].value} pending)` : undefined}
            >
              <StackedBars rows={data.chart.rows} series={data.chart.series} />
            </Card>
            {data.table && (
              <Card title="Request details" sub={data.table.rows.length >= 100 ? 'Showing the latest 100' : undefined} flush>
                <Table
                  rowKey="0"
                  empty="No requests in this period."
                  columns={data.table.columns.map((label, i) => ({
                    key: String(i),
                    label,
                    render: (row) => (i === 3 ? fmtDateTime(row[i]) : row[i]),
                  }))}
                  rows={data.table.rows}
                />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
