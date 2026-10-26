/**
 * sy18: the harness syncs as `.gz`. A local file `note.md` is `note.md.gz` in
 * every store, and its version is the hash of those zip bytes, so stores
 * pass files through without unpacking them. The checkout stays plain: the
 * plain file is the working copy.
 *
 * The zip is deterministic: fixed level, mtime 0, and a fixed OS byte, so
 * equal content zips to equal bytes on a Mac and a Linux halo alike.
 */
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from 'node:zlib'

const LEVEL = 6
const OS_BYTE = 9
const UNIX = 3

/** Which store keys sync as `.gz`: everything under a person's harness. */
export const ZIPPED = /^people\/[^/]+\/harness\//

/** @param {string} key a store key, no `can://` */
export const is_zipped = key => ZIPPED.test(key)

/**
 * The same bytes for the same content, wherever it runs.
 * @param {Uint8Array} bytes
 */
export const zip = bytes => {
  const packed = gzip_sync(bytes, { level: LEVEL })
  packed.writeUInt32LE(0, 4)
  packed[OS_BYTE] = UNIX
  return packed
}

/** @param {Uint8Array} bytes */
export const unzip = bytes => gunzip_sync(bytes)

const SUFFIX = '.gz'

/** A listing's `.gz` names, without the suffix; other names are not ours. */
const plain_names = entries =>
  Object.fromEntries(
    Object.entries(entries)
      .filter(([name]) => name.endsWith(SUFFIX))
      .map(([name, value]) => [name.slice(0, -SUFFIX.length), value])
  )

/** One response with a new body, keeping status and headers but the encoding. */
const replaced = (response, body) => {
  const headers = new Headers(response.headers)
  headers.delete('content-encoding')
  headers.delete('content-length')
  return new Response(body, { status: response.status, headers })
}

/**
 * Wrap a client `call` so harness paths travel as `.gz`: file requests go
 * to `name.gz`, PUT bodies are zipped (a gzip transport body is unpacked
 * first), GET bodies come back plain with the zip's etag, and listings drop
 * the suffix. Paths outside the harness pass through untouched.
 * @param {(method: string, path: string, options?: { body?: any, headers?: Record<string, string>, query?: string }) => Promise<Response>} call
 * @param {(path: string) => string} key
 * @param {(bytes: Uint8Array) => string} version
 */
export const zipped_call =
  (call, key, version) =>
  async (method, path, options = {}) => {
    if (!is_zipped(key(path))) return call(method, path, options)
    if (path.endsWith('/')) {
      const response = await call(method, path, options)
      if (response.status !== 200 || method !== 'GET') return response
      const listing = await response.json()
      const body =
        Array.isArray(listing.files) && Array.isArray(listing.folders)
          ? {
              ...listing,
              files: Object.keys(
                plain_names(Object.fromEntries(listing.files.map(f => [f, 1])))
              )
            }
          : plain_names(listing)
      return replaced(response, JSON.stringify(body))
    }
    const gz = `${path}${SUFFIX}`
    if (method === 'PUT') {
      const { 'content-encoding': encoding, ...headers } = options.headers ?? {}
      const raw = Buffer.from(options.body)
      const body = zip(encoding === 'gzip' ? unzip(raw) : raw)
      return call(method, gz, {
        ...options,
        body,
        headers: { ...headers, 'x-version': version(body) }
      })
    }
    const response = await call(method, gz, options)
    if (method !== 'GET' || response.status !== 200) return response
    return replaced(response, unzip(Buffer.from(await response.arrayBuffer())))
  }
