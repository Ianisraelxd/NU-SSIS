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

// Original marks for the two portals (graduation cap + monogram).
export function Logo({ kind = 'SIS', size = 84 }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 120 96" role="img" aria-label={`${kind} logo`}>
      <path d="M60 4 18 22l42 18 42-18L60 4Z" fill="#fff" />
      <path d="M36 34v14c0 6 11 12 24 12s24-6 24-12V34L60 45 36 34Z" fill="#fff" opacity="0.85" />
      <path d="M102 22v22" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="102" cy="48" r="4" fill="#fff" />
      <text
        x="60"
        y="92"
        textAnchor="middle"
        fontFamily="Montserrat, system-ui, sans-serif"
        fontWeight="800"
        fontSize="38"
        fill="#fff"
        letterSpacing="2"
      >
        {kind}
      </text>
    </svg>
  )
}
