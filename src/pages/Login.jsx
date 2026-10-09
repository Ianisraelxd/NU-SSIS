import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/icons.jsx'
import { Modal } from '../components/ui.jsx'
import { useAuth } from '../lib/auth.jsx'

const PORTALS = {
  student: {
    kind: 'SIS',
    title: 'Student Information System',
    idLabel: 'Student Number',
    autoComplete: 'username',
    home: '/',
    others: [
      { to: '/teacher/login', label: 'Teacher? Sign in here' },
      { to: '/registrar/login', label: 'Registrar or staff? Sign in here' },
    ],
  },
  teacher: {
    kind: 'FIS',
    title: 'Faculty Portal',
    idLabel: 'Employee ID',
    autoComplete: 'username',
    home: '/teacher',
    others: [
      { to: '/login', label: 'Student? Sign in here' },
      { to: '/registrar/login', label: 'Registrar or staff? Sign in here' },
    ],
  },
  registrar: {
    kind: 'RIS',
    title: 'Registrar and Records Information System',
    idLabel: 'Employee ID',
    autoComplete: 'username',
    home: '/registrar',
    others: [
      { to: '/login', label: 'Student? Sign in here' },
      { to: '/teacher/login', label: 'Teacher? Sign in here' },
    ],
  },
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

  if (user) return <Navigate to={{ student: '/', registrar: '/registrar', teacher: '/teacher' }[user.role]} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!id.trim() || !password) return setError(`Enter your ${portal.idLabel.toLowerCase()} and password.`)
    setBusy(true)
    try {
      await login(role, id, password)
      const from = location.state?.from
      navigate(from && from.startsWith(portal.home === '/' ? '/' : portal.home) ? from : portal.home, { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <Logo kind={portal.kind} size={230} />
        <h1>
          <small>National University</small>
          {portal.title}
        </h1>

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="login-id" className="sr-only">
              {portal.idLabel}
            </label>
            <input
              id="login-id"
              className="input"
              placeholder={portal.idLabel}
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoComplete={portal.autoComplete}
              autoFocus
            />
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
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <div className="login-links">
          <button type="button" onClick={() => setForgot(true)}>
            Forgot your password?
          </button>
          {portal.others.map((o) => (
            <Link key={o.to} to={o.to}>
              {o.label}
            </Link>
          ))}
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
            For security, passwords are reset in person. Visit the Registrar’s Office with a valid school ID, or ask the
            IT office to reset your account. After signing in, change your password under <b>Settings → Security</b>.
          </p>
        </Modal>
      )}
    </div>
  )
}
