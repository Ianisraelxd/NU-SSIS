import { useState } from 'react'
import { useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { burst } from '../../lib/fx.js'

const NEXT = {
  Pending: { to: 'Processing', label: 'Start processing' },
  Processing: { to: 'Ready', label: 'Mark ready' },
  Ready: { to: 'Completed', label: 'Release' },
}

// Buttons that move one request through Pending → Processing → Ready → Completed.
export default function RequestActions({ request, onChange, compact }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const next = NEXT[request.status]
  const canCancel = ['Pending', 'Processing', 'Ready'].includes(request.status)

  const move = async (status, event) => {
    const target = event.currentTarget
    if (status === 'Cancelled' && !window.confirm(`Cancel ${request.requestNo} for ${request.studentName}?`)) return
    setBusy(true)
    try {
      await api.patch(`/registrar/requests/${request.id}`, { status })
      if (status === 'Completed') burst(target)
      toast(`${request.requestNo} → ${status}`)
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
        <button className={`btn ${compact ? 'small' : ''}`} disabled={busy} onClick={(e) => move(next.to, e)}>
          {next.label}
        </button>
      )}
      {canCancel && (
        <button className={`btn danger ${compact ? 'small' : ''}`} disabled={busy} onClick={(e) => move('Cancelled', e)}>
          Cancel
        </button>
      )}
    </div>
  )
}
