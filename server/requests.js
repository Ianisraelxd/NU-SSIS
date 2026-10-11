import { db } from './db.js'
import { HttpError, audit, logRequest, notify, notifyRoles, nowIso, peso, reqNo } from './util.js'

// Pending → For Payment → Processing → Ready for Release → Released   (any open step can be Cancelled)
export const FLOW = {
  Pending: ['For Payment', 'Processing', 'Cancelled'],
  'For Payment': ['Processing', 'Cancelled'],
  Processing: ['Ready for Release', 'Cancelled'],
  'Ready for Release': ['Released', 'Cancelled'],
  Released: [],
  Cancelled: [],
}

export const REQUEST_SQL = `
  SELECT r.id, r.status, r.copies, r.purpose, r.remarks, r.total_fee AS totalFee,
         r.pickup_date AS pickupDate, r.created_at AS createdAt, r.updated_at AS updatedAt,
         r.completed_at AS completedAt, r.or_number AS orNumber, r.paid_amount AS paidAmount, r.paid_at AS paidAt,
         d.name AS document, d.id AS docTypeId,
         u.id AS studentId, u.name AS studentName, u.login_id AS studentNo, st.program, st.year_level AS yearLevel
  FROM doc_requests r
  JOIN doc_types d ON d.id = r.doc_type_id
  JOIN users u ON u.id = r.student_id
  JOIN students st ON st.user_id = r.student_id`

export const withNo = (r) => ({ ...r, requestNo: reqNo(r.id) })

const message = (row, to, from, note) =>
  ({
    'For Payment': `Your ${row.document} request (${reqNo(row.id)}) was approved. Please pay ${peso(row.totalFee)} at the Cashier.`,
    Processing: from === 'For Payment' ? `Payment received for ${reqNo(row.id)}. Your ${row.document} is now being processed.` : `Your ${row.document} request (${reqNo(row.id)}) is now being processed.`,
    'Ready for Release': `Your ${row.document} (${reqNo(row.id)}) is ready for release at the Registrar’s Office. Bring a valid school ID.`,
    Released: `Your ${row.document} request (${reqNo(row.id)}) has been released.`,
    Cancelled: `Your ${row.document} request (${reqNo(row.id)}) was cancelled${note ? `: ${note}` : '.'}`,
  })[to]

const DEFAULT_NOTE = {
  'For Payment': 'Approved — waiting for payment at the Cashier',
  Processing: 'Being processed by the Registrar',
  'Ready for Release': 'Document is ready for release',
  Released: 'Released to the student',
  Cancelled: 'Cancelled',
}

// Move a request to the next status. `patch` can set extra columns (used by the cashier to record payment).
export function moveRequest(id, to, user, { note = null, patch = {} } = {}) {
  const row = db.prepare(`${REQUEST_SQL} WHERE r.id = ?`).get(id)
  if (!row) throw new HttpError(404, 'Request not found.')
  if (!FLOW[row.status].includes(to)) throw new HttpError(409, `A request that is “${row.status}” cannot be moved to “${to}”.`)

  const now = nowIso()
  const columns = { status: to, updated_at: now, completed_at: to === 'Released' ? now : null, ...patch }
  db.prepare(`UPDATE doc_requests SET ${Object.keys(columns).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(columns), id)

  logRequest(id, to, note || DEFAULT_NOTE[to], user.id)
  notify(row.studentId, message(row, to, row.status, note), '/documents')
  if (to === 'For Payment') notifyRoles('cashier', `${row.document} ${reqNo(id)} for ${row.studentName} is waiting for payment.`, '/cashier/documents')
  audit(user, `request.${to.toLowerCase().replaceAll(' ', '-')}`, 'request', reqNo(id), `${row.document} (${row.studentNo}): ${row.status} → ${to}${note ? ` — ${note}` : ''}`)
  return withNo({ ...row, ...{ status: to, updatedAt: now } })
}
