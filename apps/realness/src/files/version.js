/**
 * A file's sync version: SHA-256 of its plain bytes, base64url, 22 characters.
 * One definition for Node and the browser. Gzip is transport and storage
 * only; it never moves the version.
 */
const LENGTH = 22

const base64url = bytes => {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** @param {string | ArrayBuffer | ArrayBufferView} body */
export const version_of = async body => {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
  const digest = await crypto.subtle.digest(
    'SHA-256',
    /** @type {BufferSource} */ (bytes)
  )
  return base64url(new Uint8Array(digest)).slice(0, LENGTH)
}
