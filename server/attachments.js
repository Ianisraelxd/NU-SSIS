// Supporting files (valid ID, authorization letter...) for a document request, kept in object storage.
import { db } from './db.js'
import { HttpError, audit, nowIso } from './util.js'
import { deleteObject, downloadUrl, putObject, requireStorage, storageReady } from './storage.js'
import { safeName, sniffType } from './filetype.js'

export const MAX_FILES = 5
export const MAX_BYTES = 2 * 1024 * 1024

export async function listFiles(requestId) {
  const rows = await db
    .prepare('SELECT id, filename, content_type AS contentType, size, object_key AS key, created_at AS createdAt FROM request_files WHERE request_id = ? ORDER BY id')
    .all(requestId)
  const ready = storageReady()
  return Promise.all(rows.map(async ({ key, ...f }) => ({ ...f, url: ready ? await downloadUrl(key, f.filename) : null })))
}

export async function addFile(user, requestId, body, rawName) {
  requireStorage()
  if (!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, 'Choose a PDF, PNG or JPEG file (up to 2 MB).')
  if (body.length > MAX_BYTES) throw new HttpError(413, 'That file is larger than 2 MB.')
  const type = sniffType(body)
  if (!type) throw new HttpError(400, 'Only PDF, PNG and JPEG files are accepted.')
  const count = await db.prepare('SELECT COUNT(*) AS n FROM request_files WHERE request_id = ?').get(requestId)
  if (Number(count.n) >= MAX_FILES) throw new HttpError(409, `You can attach up to ${MAX_FILES} files to one request.`)
  let filename = 'file'
  try {
    filename = safeName(decodeURIComponent(String(rawName ?? 'file')))
  } catch {
    filename = 'file'
  }
  const key = await putObject(`requests/${requestId}`, filename, body, type)
  const row = await db
    .prepare('INSERT INTO request_files (request_id, object_key, filename, content_type, size, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?) RETURNING id')
    .get(requestId, key, filename, type, body.length, user.id, nowIso())
  await audit(user, 'request.file.add', 'doc_request', String(requestId), filename)
  return { id: row.id, filename, contentType: type, size: body.length }
}

export async function removeFile(user, requestId, fileId) {
  requireStorage()
  const row = await db.prepare('DELETE FROM request_files WHERE id = ? AND request_id = ? RETURNING object_key, filename').get(fileId, requestId)
  if (!row) throw new HttpError(404, 'File not found.')
  await deleteObject(row.object_key).catch(() => {}) // the row is already gone; a leftover object is harmless
  await audit(user, 'request.file.remove', 'doc_request', String(requestId), row.filename)
}
