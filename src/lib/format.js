const YEARS = ['First', 'Second', 'Third', 'Fourth', 'Fifth']

export const yearName = (n) => `${YEARS[n - 1] ?? n} Year`

// "A.Y. 2026-2027, First Semester" -> "First Semester A.Y. 2026 - 2027"
export function termTitle(label = '') {
  const m = label.match(/A\.Y\. (\d{4})-(\d{4}), (.+)/)
  return m ? `${m[3]} A.Y. ${m[1]} - ${m[2]}` : label
}

export const subtitle = (yearLevel, term) => `${yearName(yearLevel)} - ${termTitle(term)}`

export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH')}`

const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const shortFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' })

export const fmtDate = (v) => (v ? dateFmt.format(new Date(v.length === 10 ? `${v}T00:00:00` : v)) : '—')
export const fmtShort = (v) => (v ? shortFmt.format(new Date(v.length === 10 ? `${v}T00:00:00` : v)) : '—')
export const fmtDateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : '—')

export function fmtMinutes(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d ago`
  return fmtDate(iso)
}

export function dueLabel(iso) {
  const ms = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(ms / 86400000)
  if (ms < 0) return { text: `Overdue · ${fmtDate(iso)}`, late: true }
  if (days <= 1) return { text: `Due today · ${fmtDateTime(iso)}`, late: true }
  if (days <= 3) return { text: `Due in ${days} days · ${fmtDate(iso)}`, late: true }
  return { text: `Due ${fmtDate(iso)}`, late: false }
}

export const statusTone = (status) =>
  ({
    Cleared: 'ok',
    Paid: 'ok',
    Passed: 'ok',
    Completed: 'ok',
    Ready: 'ok',
    Enrolled: 'ok',
    Pending: 'warn',
    Due: 'warn',
    Processing: 'info',
    'In Progress': 'info',
    Hold: 'bad',
    Failed: 'bad',
    Cancelled: 'muted',
    'Not Started': 'muted',
  })[status] ?? 'muted'

export const point = (p) => (p == null ? '—' : p.toFixed(2))
