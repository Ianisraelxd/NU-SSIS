import { useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useApi } from '../lib/hooks.js'
import { fmtDateTime } from '../lib/format.js'
import { useConfirm, useToast } from './ui.jsx'

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// Supporting files of a document request. `base` is the request's API path; `canEdit` lets the
// student add or remove files while the request is still open.
export default function Attachments({ base, canEdit = false }) {
  const state = useApi(`${base}/files`)
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return toast('That file is larger than 2 MB.', 'error')
    setBusy(true)
    try {
      await api.upload(`${base}/files`, file)
      toast('File attached.')
      state.reload()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (f) => {
    if (!(await confirm({ title: 'Remove this file?', message: f.filename, confirmLabel: 'Remove' }))) return
    try {
      await api.delete(`${base}/files/${f.id}`)
      state.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const files = state.data?.files ?? []
  return (
    <div>
      <h3 className="mini-title" style={{ marginTop: 0 }}>
        Attached files
      </h3>
      {state.loading && <p className="muted">Loading…</p>}
      {state.error && <p className="muted">Files are unavailable right now.</p>}
      {state.data && files.length === 0 && <p className="muted">No files attached.</p>}
      <ul className="stack" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
        {files.map((f) => (
          <li key={f.id} className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer">
                  {f.filename}
                </a>
              ) : (
                f.filename
              )}{' '}
              <span className="muted">
                · {kb(f.size)} · {fmtDateTime(f.createdAt)}
              </span>
            </span>
            {canEdit && (
              <button className="btn small secondary" onClick={() => remove(f)}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && state.data?.storage !== false && (
        <p>
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={pick} />
          <button className="btn small secondary" disabled={busy || files.length >= 5} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : 'Attach a file'}
          </button>{' '}
          <span className="muted">PDF, PNG or JPEG, up to 2 MB, at most 5 files.</span>
        </p>
      )}
      {canEdit && state.data?.storage === false && <p className="muted">File attachments are not available on this server.</p>}
    </div>
  )
}
