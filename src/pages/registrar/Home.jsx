import { useState } from 'react'
import { MegaphoneIcon } from '../../components/icons.jsx'
import { Async, Card, Field, Modal, Stat, useConfirm, useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'
import { fmtDate } from '../../lib/format.js'
import { useApi } from '../../lib/hooks.js'

function AnnouncementForm({ initial, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ title: initial?.title ?? '', body: initial?.body ?? '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      if (initial) await api.put(`/registrar/announcements/${initial.id}`, form)
      else await api.post('/registrar/announcements', form)
      toast(initial ? 'Announcement updated.' : 'Announcement posted to all students.')
      onSaved()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit announcement' : 'New announcement'}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={save}>
            {initial ? 'Save changes' : 'Post announcement'}
          </button>
        </>
      }
    >
      <Field label="Title" htmlFor="ann-title" error={error}>
        <input id="ann-title" className="input" maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <Field label="Message" htmlFor="ann-body" help={initial ? undefined : 'Students are notified when you post.'}>
        <textarea id="ann-body" className="textarea" rows={6} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </Field>
    </Modal>
  )
}

export default function RegistrarHome() {
  const toast = useToast()
  const confirm = useConfirm()
  const overview = useApi('/registrar/overview')
  const announcements = useApi('/announcements')
  const [editing, setEditing] = useState(null) // null | 'new' | announcement

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Delete this announcement?',
      message: `“${a.title}” will no longer be visible to students.`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await api.delete(`/registrar/announcements/${a.id}`)
      toast('Announcement deleted.')
      announcements.reload()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="stack">
      <div className="hero">
        <h1>
          Welcome to <b>Registrar Information System</b> v1.0
        </h1>
        <p>National University Laguna Campus</p>
      </div>

      <Async state={overview}>
        {(o) => (
          <div className="grid stats">
            <Stat label="Waiting in queue" to="/registrar/queue" value={o.pending} tone={o.pending ? 'warn' : 'ok'} />
            <Stat label="Being processed" to="/registrar/queue" value={o.processing} />
            <Stat label="Ready for pickup" to="/registrar/requests" value={o.ready} />
            <Stat label="Released today" to="/registrar/requests" value={o.completedToday} tone="ok" />
            <Stat label="Students on hold" to="/registrar/clearance" value={o.studentsOnHold} tone={o.studentsOnHold ? 'bad' : 'ok'} hint={`of ${o.students} students`} />
          </div>
        )}
      </Async>

      <div className="page-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title">
          <MegaphoneIcon /> Announcements
        </h2>
        <button className="btn" onClick={() => setEditing('new')}>
          New announcement
        </button>
      </div>

      <Async state={announcements}>
        {(items) => (
          <div className="stack">
            {items.length === 0 && <Card>No announcements yet. Post the first one.</Card>}
            {items.map((a) => (
              <Card key={a.id} className="announcement">
                <div className="card-head" style={{ marginBottom: 0 }}>
                  <div>
                    <h3>{a.title}</h3>
                    <time dateTime={a.createdAt}>
                      {fmtDate(a.createdAt)} · {a.author ?? 'Registrar'}
                    </time>
                  </div>
                  <div className="actions">
                    <button className="btn small secondary" onClick={() => setEditing(a)}>
                      Edit
                    </button>
                    <button className="btn small danger" onClick={() => remove(a)}>
                      Delete
                    </button>
                  </div>
                </div>
                <p>{a.body}</p>
              </Card>
            ))}
          </div>
        )}
      </Async>

      {editing && (
        <AnnouncementForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            announcements.reload()
          }}
        />
      )}
    </div>
  )
}
