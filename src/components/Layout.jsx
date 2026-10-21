import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { ROLE_LABEL, timeAgo } from '../lib/format.js'
import { useRealtime, useRealtimeEvents } from '../lib/realtime.jsx'
import { BackIcon, BellIcon, BulbIcon, CloseIcon, Logo, MenuIcon, UserIcon } from './icons.jsx'
import { Loading, useClickAway, useToast } from './ui.jsx'

function NotificationBell({ base }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ items: [], unread: 0 })
  const ref = useRef(null)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  useClickAway(ref, close)

  const load = useCallback(() => api.get('/notifications').then(setData).catch(() => {}), [])
  useRealtimeEvents((ev) => ev.type === 'notification' && load())
  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const openItem = async (n) => {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`).catch(() => {})
    setOpen(false)
    load()
    if (n.link) navigate(n.link.startsWith('/registrar') || n.link.startsWith('/teacher') ? n.link : base + n.link)
  }

  const readAll = async () => {
    await api.post('/notifications/read-all')
    load()
  }

  return (
    <div className="popover-wrap" ref={ref}>
      <button
        className={`icon-btn ${data.unread > 0 ? 'has-unread' : ''}`}
        onClick={() => {
          setOpen(!open)
          if (!open) load()
        }}
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
      >
        <BellIcon />
        {data.unread > 0 && <span className="dot">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <header>
            Notifications
            {data.unread > 0 && (
              <button className="btn small secondary" onClick={readAll}>
                Mark all read
              </button>
            )}
          </header>
          <div className="list">
            {data.items.length === 0 && <div className="empty">You’re all caught up.</div>}
            {data.items.map((n) => (
              <button key={n.id} className={`note-item ${n.isRead ? '' : 'unread'}`} onClick={() => openItem(n)}>
                {n.message}
                <time>{timeAgo(n.createdAt)}</time>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileMenu({ base }) {
  const { logout, user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickAway(ref, close)
  return (
    <div className="popover-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}>
        <UserIcon />
      </button>
      {open && (
        <div className="popover narrow">
          <header>{user.name}</header>
          <Link className="menu-item" to={`${base}/settings`.replace('//', '/')} onClick={close}>
            Settings
          </Link>
          <button className="menu-item" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout({ kind, brandName, base, nav, secondaryNav, logoClass = '' }) {
  const { user, theme, savePreferences } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const { unread: unreadMessages } = useRealtime()
  // the mobile drawer closes by itself when the route changes
  const [openAt, setOpenAt] = useState(null)
  const open = openAt === location.pathname
  const setOpen = (value) => setOpenAt(value ? location.pathname : null)
  const path = (to) => (to === '' ? base || '/' : `${base}/${to}`)
  const navigate = useNavigate()
  const home = path('')
  const atHome = location.pathname === home || location.pathname === `${home}/`
  // Back goes to the page the user came from; when the app was opened on this page it goes to the portal's home page
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(home))

  // Menu drawer on tablets and phones: Escape closes it, and the page behind it does not scroll while it is open
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpenAt(null)
    document.addEventListener('keydown', onKey)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('drawer-open')
    }
  }, [open])

  // Swipe left to close the menu; swipe right from the left edge of the screen to open it
  const touch = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    if (Math.abs(t.clientY - start.y) > 60 || Math.abs(dx) < 70) return
    if (open && dx < 0) setOpenAt(null)
    else if (!open && dx > 0 && start.x < 28) setOpen(true)
  }

  const toggleTheme = async () => {
    try {
      await savePreferences({
        theme: theme === 'dark' ? 'light' : 'dark',
        notifyInapp: user.notifyInapp,
        notifyEmail: user.notifyEmail,
      })
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const link = (item) => (
    <NavLink
      key={item.to}
      to={path(item.to)}
      end={item.to === ''}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
    >
      {item.label}
      {item.to === 'messages' && unreadMessages > 0 && <span className="nav-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
    </NavLink>
  )

  return (
    <div className="shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpenAt(null)} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <button className="icon-btn drawer-close" onClick={() => setOpenAt(null)} aria-label="Close menu">
          <CloseIcon />
        </button>
        <div className="brand">
          <Logo kind={kind} className={logoClass} />
          <small>National University</small>
          <strong>{brandName}</strong>
        </div>
        <nav className="nav">{nav.map(link)}</nav>
        <nav className="nav">
          {(secondaryNav ?? []).map(link)}
          {link({ to: 'settings', label: 'Settings' })}
          <LogoutLink />
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="who">
            <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
              <MenuIcon />
            </button>
            {!atHome && (
              <button className="icon-btn back-btn" onClick={goBack} aria-label="Go back to the previous page">
                <BackIcon />
                <span>Back</span>
              </button>
            )}
            <span className="id">{user.role === 'student' ? user.loginId : user.role === 'department' && user.department ? `${ROLE_LABEL.department} · ${user.department.code}` : ROLE_LABEL[user.role]}</span>
            <span className="sep" />
            <span className="name">{user.name}</span>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <BulbIcon />
            </button>
            <NotificationBell base={base} />
            <ProfileMenu base={base} />
          </div>
        </header>
        <main className="content" id="main">
          <div className="page" key={location.pathname}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}

function LogoutLink() {
  const { logout } = useAuth()
  return (
    <button className="nav-link" onClick={logout}>
      Logout
    </button>
  )
}
