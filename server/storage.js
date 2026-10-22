// Neon Object Storage (S3-compatible). Credentials, endpoint and region come from the standard
// AWS_* variables that `neon deploy` writes to .env.local. Without them the app still runs; only
// file attachments are unavailable.
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { HttpError } from './util.js'
import { safeName } from './filetype.js'

const BUCKET = process.env.STORAGE_BUCKET || 'uploads'
export const storageReady = () => !!(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)

let client
const s3 = () => (client ??= new S3Client({ forcePathStyle: true })) // Neon needs path-style addressing

export function requireStorage() {
  if (!storageReady()) throw new HttpError(503, 'File storage is not set up on this server.')
}

export async function putObject(prefix, filename, body, contentType) {
  const key = `${prefix}/${randomUUID()}-${safeName(filename).replace(/ /g, '_')}`
  await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return key
}

export const deleteObject = (key) => s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))

// A short-lived link so the browser can fetch a private file without ever seeing the credentials.
export const downloadUrl = (key, filename) =>
  getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `attachment; filename="${safeName(filename)}"` }), { expiresIn: 300 })

export async function readObject(key) {
  const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return Buffer.from(await res.Body.transformToByteArray())
}
