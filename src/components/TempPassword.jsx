import { useState } from 'react'
import { Modal } from './ui.jsx'

// Shown once after creating an account or resetting a password. The server never shows it again.
export default function TempPassword({ loginId, password, title = 'Account ready', onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked — the password can still be selected by hand */
    }
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy password'}
          </button>
          <button className="btn" onClick={onClose}>
            I’ve saved it
          </button>
        </>
      }
    >
      <p>
        Give these sign-in details to the user. <b>The password is shown only once</b> and they should change it under Settings → Security after signing in.
      </p>
      <dl className="kv" style={{ margin: '16px 0' }}>
        <dt>ID</dt>
        <dd>{loginId}</dd>
        <dt>Temporary password</dt>
        <dd>
          <span className="secret">{password}</span>
        </dd>
      </dl>
    </Modal>
  )
}
