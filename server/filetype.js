// File checks that need no database or network.
// The kind of file is decided by its first bytes, not by what the browser says.
export function sniffType(buf) {
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf'
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  return null
}

export const safeName = (name) =>
  String(name ?? 'file').replace(/[^\w.\- ]+/g, '_').replace(/\.{2,}/g, '.').trim().slice(0, 80) || 'file'
