import { Async, Card, PageHead } from '../../components/ui.jsx'
import { useApi } from '../../lib/hooks.js'

const cell = (v) => (v === '—' ? <span className="perm-none">—</span> : <span className="perm-full">{v === 'full' ? '✓' : v}</span>)

export default function Permissions() {
  const state = useApi('/admin/permissions')
  return (
    <>
      <PageHead title="Roles & Permissions" subtitle="What each module is allowed to do. A person’s role decides which module they sign in to." />
      <Async state={state}>
        {({ roles, rows }) => (
          <Card flush>
            <div className="table-wrap">
              <table className="table matrix">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Capability</th>
                    {roles.map((r) => (
                      <th key={r}>{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{rows[i - 1]?.area === r.area ? '' : <b>{r.area}</b>}</td>
                      <td>{r.capability}</td>
                      {r.access.map((a, j) => (
                        <td key={j}>{cell(a)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Async>
    </>
  )
}
