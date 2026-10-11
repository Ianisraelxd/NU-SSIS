import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { fmtDateTime } from '../lib/format.js'
import { Card, ErrorState, Loading, PageHead, Stat, StackedBars, Table } from './ui.jsx'

const PERIODS = [
  ['today', 'Today'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['all', 'All time'],
]

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`

function downloadCsv(report, title) {
  const lines = [
    [`${title} — generated ${fmtDateTime(report.generatedAt)}`],
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

// One report page for every module. `types` is [[key, label, usesPeriod]]; the API returns a common shape.
export default function ReportViewer({ endpoint, types, title = 'Reports', subtitle = 'Generate, print or export a report.' }) {
  const [draft, setDraft] = useState({ type: types[0][0], period: 'week' })
  const [applied, setApplied] = useState(draft)
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => {
    let cancelled = false
    api
      .get(`${endpoint}?type=${applied.type}&period=${applied.period}`)
      .then((data) => !cancelled && setState({ loading: false, data, error: null }))
      .catch((error) => !cancelled && setState({ loading: false, data: null, error }))
    return () => {
      cancelled = true
    }
  }, [applied, endpoint])

  const generate = () => {
    setState((s) => ({ ...s, loading: true }))
    setApplied({ ...draft })
  }

  const usesPeriod = (key) => types.find(([k]) => k === key)?.[2] !== false
  const label = (key) => types.find(([k]) => k === key)?.[1]
  const { data, loading, error } = state
  const periodLabel = PERIODS.find(([k]) => k === (data?.period ?? applied.period))?.[1]

  return (
    <>
      <PageHead title={title} subtitle={subtitle} />
      <div className="stack">
        <div className="toolbar no-print">
          <label className="sr-only" htmlFor="rp-period">
            Period
          </label>
          <select id="rp-period" className="select" value={draft.period} disabled={!usesPeriod(draft.type)} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
            {PERIODS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="rp-type">
            Report type
          </label>
          <select id="rp-type" className="select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {types.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn" onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {data && (
            <>
              <button className="btn secondary" onClick={() => downloadCsv(data, label(data.type))}>
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
              {label(data.type)}
              {usesPeriod(data.type) ? ` · ${periodLabel}` : ''} · generated {fmtDateTime(data.generatedAt)}
            </p>
            <div className="grid stats">
              {data.stats.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
            <Card title={data.chart.title}>
              <StackedBars rows={data.chart.rows} series={data.chart.series} />
            </Card>
            {data.table && (
              <Card title="Details" sub={data.table.rows.length >= 100 ? 'Showing the latest 100' : undefined} flush>
                <Table
                  rowKey="0"
                  empty="Nothing in this period."
                  columns={data.table.columns.map((l, i) => ({
                    key: String(i),
                    label: l,
                    render: (row) => (/^\d{4}-\d{2}-\d{2}T/.test(String(row[i])) ? fmtDateTime(row[i]) : row[i]),
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
