import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/icons.jsx'
import { Modal } from '../components/ui.jsx'
import { FEATURES } from '../config.js'
import { useAuth } from '../lib/auth.jsx'

export const HOME = { student: '/', registrar: '/registrar', cashier: '/cashier', department: '/department', admin: '/admin', teacher: '/teacher' }

const PORTALS = {
  student: { kind: 'SIS', title: 'Student Services Information System', idLabel: 'Student Number', login: '/login', link: 'Student' },
  registrar: { kind: 'RIS', title: 'Registrar and Records Information System', idLabel: 'Employee ID', login: '/registrar/login', link: 'Registrar' },
  cashier: { kind: 'SIS', tint: 'cashier', title: 'Cashier Module', idLabel: 'Employee ID', login: '/cashier/login', link: 'Cashier' },
  department: { kind: 'SIS', tint: 'department', title: 'Department Module', idLabel: 'Employee ID', login: '/department/login', link: 'Department' },
  admin: { kind: 'SIS', tint: 'admin', title: 'Admin Module', idLabel: 'Employee ID', login: '/admin/login', link: 'Admin' },
  teacher: { kind: 'SIS', tint: 'fis', title: 'Faculty Portal', idLabel: 'Employee ID', login: '/teacher/login', link: 'Teacher' },
}

export default function Login({ role }) {
  const portal = PORTALS[role]
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

  if (user) return <Navigate to={HOME[user.role]} replace />

  const home = HOME[role]
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!id.trim() || !password) return setError(`Enter your ${portal.idLabel.toLowerCase()} and password.`)
    setBusy(true)
    try {
      await login(role, id, password)
      const from = location.state?.from
      navigate(from && from.startsWith(home === '/' ? '/' : home) ? from : home, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const others = Object.entries(PORTALS).filter(([key]) => key !== role && (key !== 'teacher' || FEATURES.lms))

  return (
    <div className="login">
      <div className="login-card">
        <Logo kind={portal.kind} size={230} className={portal.tint ? `logo-tint-${portal.tint}` : ''} />
        <h1>
          <small>National University</small>
          {portal.title}
        </h1>

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-id" className="sr-only">
              {portal.idLabel}
            </label>
            <input id="login-id" className="input" placeholder={portal.idLabel} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="login-pw" className="sr-only">
              Password
            </label>
            <div className="pw-wrap">
              <input
                id="login-pw"
                className="input"
                type={show ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && (
            <p className="error-text" role="alert" style={{ marginBottom: 14, textAlign: 'center' }}>
              {error}
            </p>
          )}
          <button className="btn block" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="login-links">
          <button type="button" onClick={() => setForgot(true)}>
            Forgot your password?
          </button>
          <p className="login-switch">
            Sign in as:{' '}
            {others.map(([key, p], i) => (
              <span key={key}>
                {i > 0 && ' · '}
                <Link to={p.login}>{p.link}</Link>
              </span>
            ))}
          </p>
        </div>
        <p className="login-foot">National University · Laguna Campus</p>
      </div>

      {forgot && (
        <Modal
          title="Reset your password"
          onClose={() => setForgot(false)}
          footer={
            <button className="btn" onClick={() => setForgot(false)}>
              Got it
            </button>
          }
        >
          <p>
            For security, passwords are reset in person. Visit the Registrar’s Office with a valid school ID, or ask the school’s system administrator to reset your account. After signing
            in, change your password under <b>Settings → Security</b>.
          </p>
          <p style={{ marginTop: 10 }} className="muted">
            Tip: after 5 wrong attempts an account is locked for 15 minutes to protect it.
          </p>
        </Modal>
      )}
    </div>
  )
}
