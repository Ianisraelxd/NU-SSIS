import { LOGO, RIS_LOGO } from '../assets/logo-paths.js'

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const BulbIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
  </svg>
)
export const BellIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />
  </svg>
)
export const UserIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
)
export const MenuIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)
export const MegaphoneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </svg>
)
export const CheckIcon = (p) => (
  <svg {...base} strokeWidth={3} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

// Official portal emblems, traced to vector so they can take any colour (they use currentColor).
//   SIS  → Student portal   · FIS → Faculty portal (same emblem, gold)   · RIS → Registrar portal
export function Logo({ kind = 'SIS', size = 150, className = '' }) {
  const art = kind === 'RIS' ? { d: RIS_LOGO.d, w: RIS_LOGO.w, h: RIS_LOGO.h } : { d: LOGO.mark.d, w: LOGO.mark.w, h: LOGO.mark.h }
  const label = { SIS: 'Student Information System', FIS: 'Faculty Portal', RIS: 'Registrar and Records Information System' }[kind]
  return (
    <svg
      className={`logo logo-${kind.toLowerCase()} ${className}`}
      width={size}
      height={(size * art.h) / art.w}
      viewBox={`0 0 ${art.w} ${art.h}`}
      fill="currentColor"
      fillRule="evenodd"
      role="img"
      aria-label={label}
    >
      <path d={art.d} />
    </svg>
  )
}

export const SendIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" />
  </svg>
)
export const ChatIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z" />
  </svg>
)
export const BackIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5 8 12l7 7" />
  </svg>
)
export const EditIcon = (p) => (
  <svg {...base} width={16} height={16} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
  </svg>
)
export const TrashIcon = (p) => (
  <svg {...base} width={16} height={16} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
export const SmileIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
  </svg>
)
