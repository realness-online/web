/**
 * Storage over the sync service, in the shapes the app already reads from
 * Firebase Storage: `{ items, prefixes }` listings, `customMetadata.hash`,
 * and download URLs. `customMetadata.hash` is the sync version, the plain
 * bytes' hash, so `content_hash` is `version_of` the HTML. A gzip upload
 * says so and carries the version the worker took before packing.
 */
import { version_of } from '#root/src/files/version.js'

const NOT_FOUND = 404
const FORBIDDEN = 403
const META = { sold: 'x-meta-sold', fullLocale: 'x-meta-full-locale' }

/** Firebase's error codes, so callers keep one check each. */
const storage_error = (path, code) =>
  Object.assign(new Error(`${path}: ${code}`), { code })

/** The version this HTML will have once stored. */
export const content_hash = html => version_of(html)

/**
 * `Content-Encoding` and `X-Version` for one upload: a gzip body names its
 * plain version from the worker; a string is hashed here.
 * @param {string | Blob} data
 * @param {{ contentEncoding?: string, customMetadata?: Record<string, string> }} meta
 */
/** @returns {Promise<Record<string, string>>} */
const packing_headers = async (data, meta) => {
  if (meta?.contentEncoding === 'gzip') {
    const version = meta.customMetadata?.version
    return version
      ? { 'content-encoding': 'gzip', 'x-version': version }
      : { 'content-encoding': 'gzip' }
  }
  if (typeof data === 'string') return { 'x-version': await version_of(data) }
  return {}
}

const ref_of = path => ({
  fullPath: path,
  name: path.replace(/\/$/, '').split('/').pop() ?? ''
})

/**
 * @param {{ base: string, token: () => Promise<string | null | undefined> }} options
 */
export const sync_storage = ({ base, token }) => {
  const root = base.replace(/\/$/, '')
  const address = path =>
    `${root}/${path.split('/').map(encodeURIComponent).join('/')}`
  /**
   * @param {string} method
   * @param {string} path
   * @param {{ headers?: Record<string, string>, body?: BodyInit }} [options]
   */
  const call = async (method, path, { headers = {}, body } = {}) => {
    const bearer = await token()
    const init = {
      method,
      headers: {
        ...headers,
        ...(bearer && { authorization: `Bearer ${bearer}` })
      }
    }
    return fetch(address(path), body === undefined ? init : { ...init, body })
  }
  const failed = (what, response) => {
    if (response.status === NOT_FOUND)
      throw storage_error(what, 'storage/object-not-found')
    if (response.status === FORBIDDEN)
      throw storage_error(what, 'storage/unauthorized')
    throw new Error(`sync ${what}: ${response.status}`)
  }
  const path_of = place =>
    typeof place === 'string' ? place : String(place.fullPath)
  const meta_headers = meta =>
    Object.fromEntries(
      Object.entries(META)
        .filter(([key]) => typeof meta?.[key] === 'string')
        .map(([key, header]) => [header, meta[key]])
    )
  const meta_from = headers =>
    Object.fromEntries(
      Object.entries(META)
        .filter(([, header]) => headers.get(header) !== null)
        .map(([key, header]) => [key, String(headers.get(header))])
    )
  /** @returns {{ fullPath: string, name: string, md5Hash: null, updated: string | null, customMetadata: Record<string, string | null> }} */
  const described = (path, response) => ({
    ...ref_of(path),
    md5Hash: null,
    updated: response.headers.get('last-modified'),
    customMetadata: {
      ...meta_from(response.headers),
      hash: response.headers.get('etag')?.replace(/"/g, '') ?? null
    }
  })

  const metadata = async place => {
    const path = path_of(place)
    const response = await call('HEAD', path)
    if (!response.ok) await failed(path, response)
    return described(path, response)
  }

  const upload = async (path, data, meta = {}) => {
    const response = await call('PUT', path, {
      body: data,
      headers: {
        ...meta_headers(meta.customMetadata),
        ...(await packing_headers(data, meta))
      }
    })
    if (!response.ok) await failed(path, response)
    const version = response.headers.get('etag')?.replace(/"/g, '') ?? null
    return {
      ref: ref_of(path),
      metadata: {
        ...ref_of(path),
        customMetadata: { ...meta.customMetadata, hash: version }
      }
    }
  }

  const remove = async path => {
    const response = await call('DELETE', path)
    if (response.ok || response.status === NOT_FOUND) return
    await failed(path, response)
  }

  /** The URL a signed-in `fetch_file` reads; checks the file is there. */
  const url = async path => {
    await metadata(path)
    return address(path)
  }

  const directory = async path => {
    const folder = path.replace(/\/?$/, '/')
    const response = await call('GET', folder)
    if (!response.ok) await failed(folder, response)
    const { files, folders } = await response.json()
    return {
      items: files.map(name => ref_of(`${folder}${name}`)),
      prefixes: folders.map(name => ref_of(`${folder}${name}/`))
    }
  }

  /** Copy with the meta, then delete; a failed delete takes the copy back. */
  const move = async (from, to) => {
    const source = await call('GET', from)
    if (!source.ok) return false
    const put = await call('PUT', to, {
      body: await source.blob(),
      headers: meta_headers(meta_from(source.headers))
    })
    if (!put.ok) return false
    const gone = await call('DELETE', from)
    if (gone.ok) return true
    await call('DELETE', to)
    return false
  }

  /** Reads a URL from `url`, signed in. */
  const fetch_file = async address => {
    const bearer = await token()
    return fetch(address, {
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {}
    })
  }

  return {
    location: ref_of,
    metadata,
    upload,
    remove,
    url,
    directory,
    move,
    fetch_file,
    content_hash
  }
}
