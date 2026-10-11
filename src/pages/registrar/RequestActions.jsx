import { useState } from 'react'
import { useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'

// What the Registrar can do at each step. "For Payment" belongs to the Cashier.
const NEXT = {
  Pending: { action: 'approve', label: 'Approve' },
  Processing: { action: 'ready', label: 'Mark ready' },
  'Ready for Release': { action: 'release', label: 'Release' },
}
const OPEN = ['Pending', 'For Payment', 'Processing', 'Ready for Release']

export default function RequestActions({ request, onChange, compact }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const next = NEXT[request.status]
  const canCancel = OPEN.includes(request.status)

  const run = async (action, event) => {
    const target = event.currentTarget
    if (action === 'cancel') {
      const ok = await confirm({
        title: 'Cancel this request?',
        message: `${request.requestNo} (${request.document}) for ${request.studentName} will be cancelled and the student will be notified.`,
        confirmLabel: 'Cancel request',
        cancelLabel: 'Keep it',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const result = await api.patch(`/registrar/requests/${request.id}`, { action })
      if (action === 'release') burst(target)
      toast(`${request.requestNo} → ${result.status}`)
      onChange?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!next && !canCancel) return <span className="muted">—</span>
  return (
    <div className="actions">
      {next && (
        <button className={`btn ${compact ? 'small' : ''}`} disabled={busy} onClick={(e) => run(next.action, e)}>
          {next.label}
        </button>
      )}
      {request.status === 'For Payment' && <span className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>At the Cashier</span>}
      {canCancel && (
        <button className={`btn danger ${compact ? 'small' : ''}`} disabled={busy} onClick={(e) => run('cancel', e)}>
          Cancel
        </button>
      )}
    </div>
  )
}
