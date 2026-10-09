import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { statusTone } from '../lib/format.js'
import { CloseIcon } from './icons.jsx'

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Card({ title, sub, actions, flush, className = '', children }) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p className="sub">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone, to }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </>
  )
  return to ? (
    <Link to={to} className={`stat tone-${tone ?? ''}`}>
      {body}
    </Link>
  ) : (
    <div className={`stat tone-${tone ?? ''}`}>{body}</div>
  )
}

export const Badge = ({ status, tone, children }) => (
  <span className={`badge ${tone ?? statusTone(status)}`}>{children ?? status}</span>
)

export function Table({ columns, rows, rowKey = 'id', empty = 'Nothing to show yet.', footer }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty">{empty}</div>
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  )
}

export const Loading = () => <div className="spinner" role="status" aria-label="Loading" />

export function ErrorState({ error, retry }) {
  return (
    <div className="alert bad" role="alert">
      <div>
        <strong>Couldn’t load this page.</strong> {error?.message}{' '}
        {retry && (
          <button className="btn small secondary" onClick={retry} style={{ marginLeft: 8 }}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

// Renders loading / error states and calls children(data) when ready.
export function Async({ state, children }) {
  if (state.loading && !state.data) return <Loading />
  if (state.error && !state.data) return <ErrorState error={state.error} retry={state.retry} />
  return children(state.data)
}

export function Modal({ title, onClose, children, footer }) {
  const id = useId()
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <header>
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  )
}

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random()
    setItems((list) => [...list, { id, message, kind }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function Field({ label, help, error, children, htmlFor }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help && !error && <span className="help">{help}</span>}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

// Stacked horizontal bars (design: "Request per Document Type")
export function StackedBars({ rows, series }) {
  const max = Math.max(1, ...rows.map((r) => r.a + r.b))
  return (
    <div>
      <div className="legend" aria-hidden>
        <span>
          <i style={{ background: 'var(--primary)' }} />
          {series[0]}
        </span>
        <span>
          <i style={{ background: 'color-mix(in srgb, var(--muted) 55%, var(--surface))' }} />
          {series[1]}
        </span>
      </div>
      {rows.map((r) => (
        <div className="chart-row" key={r.label}>
          <span>{r.label}</span>
          <div
            className="bar stacked"
            role="img"
            aria-label={`${r.label}: ${r.a} ${series[0].toLowerCase()}, ${r.b} ${series[1].toLowerCase()}`}
          >
            <span className="a" style={{ width: `${(r.a / max) * 100}%` }} />
            <span className="b" style={{ width: `${(r.b / max) * 100}%` }} />
          </div>
          <span className="num">{r.a + r.b}</span>
        </div>
      ))}
    </div>
  )
}

export function useClickAway(ref, handler) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && handler()
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, handler])
}
