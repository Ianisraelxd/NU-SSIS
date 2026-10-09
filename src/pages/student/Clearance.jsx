import { Async, Badge, Card, PageHead, Stat, Table } from '../../components/ui.jsx'
import { subtitle } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

export default function Clearance() {
  const state = useApi('/student/clearance')
  return (
    <Async state={state}>
      {(d) => (
        <>
          <PageHead title="Clearance Requirements" subtitle={subtitle(d.yearLevel, d.term)} />
          <div className="stack">
            <div className="grid stats">
              <Stat label="Cleared" value={`${d.summary.cleared} of ${d.summary.total}`} tone="ok" />
              <Stat label="Pending" value={d.summary.pending} tone={d.summary.pending ? 'warn' : undefined} />
              <Stat label="On hold" value={d.summary.hold} tone={d.summary.hold ? 'bad' : undefined} />
            </div>
            {d.summary.complete ? (
              <div className="alert ok">
                <div>
                  <strong>All clear.</strong> Every office has cleared you. You can now request documents.
                </div>
              </div>
            ) : (
              <div className="alert warn">
                <div>
                  <strong>Clearance incomplete.</strong> Resolve the items below. Some documents (like the Transcript of Records)
                  can’t be requested until every office has cleared you.
                </div>
              </div>
            )}
            <Card title="Clearance per office" flush>
              <Table
                columns={[
                  { key: 'office', label: 'Office', render: (r) => <b>{r.office}</b> },
                  { key: 'requirement', label: 'Requirement' },
                  { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
                  { key: 'remarks', label: 'Remarks', render: (r) => r.remarks ?? '—' },
                ]}
                rows={d.offices}
              />
            </Card>
          </div>
        </>
      )}
    </Async>
  )
}
