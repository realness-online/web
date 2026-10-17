/**
 * Google Cloud Storage over its JSON API: plain fetch, no dependencies.
 *
 *   create_gcs({ bucket, token, prefix })
 *
 * `token()` resolves to an OAuth access token: `metadata_token()` on Cloud
 * Run, `gcloud_token()` on a laptop. `prefix` scopes every key, so tests can
 * run inside a throwaway folder. Versions are object generations, and
 * `ifGenerationMatch=0` is a true create-only write.
 *
 * Text keys are stored gzip (`contentEncoding`). Fetch decodes on the way
 * out, so `get` returns exactly what `put` was given.
 */
import { randomUUID as random_uuid } from 'node:crypto'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { gzipSync as gzip_sync } from 'node:zlib'
import { Conflict } from './disk.js'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- list pages follow the previous page's token */

const CLI_TOKEN_MINUTES = 30

const API = 'https://storage.googleapis.com/storage/v1/b'
const UPLOAD = 'https://storage.googleapis.com/upload/storage/v1/b'

/** Keys worth compressing at rest; everything else is stored as given. */
const TEXT = /\.(html|md|jsonl|json|svg|txt|css|js|xml|csv|ya?ml)$/i

/** Gzip text when that makes it smaller; `gzip: true` always packs. */
const at_rest = (key, body, gzip) => {
  if (!gzip && !TEXT.test(key)) return { body }
  const packed = gzip_sync(Buffer.from(body))
  return gzip || packed.length < Buffer.byteLength(body)
    ? { body: packed, encoding: 'gzip' }
    : { body }
}

/** One multipart/related upload body: the object's JSON resource, then its bytes. */
const multipart = (resource, bytes) => {
  const boundary = `realness-${random_uuid()}`
  return {
    type: `multipart/related; boundary=${boundary}`,
    body: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\ncontent-type: application/json; charset=utf-8\r\n\r\n${JSON.stringify(resource)}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
  }
}

/** The upload for one stored body: gzip carries its real size in metadata. */
const upload_of = (name, body, stored) =>
  stored.encoding
    ? multipart(
        {
          name,
          contentEncoding: stored.encoding,
          metadata: { size: String(Buffer.byteLength(body)) }
        },
        stored.body
      )
    : { type: 'application/octet-stream', body: stored.body }

/** Cache a token until a minute before it expires. */
const cached = fetch_token => {
  let token = null
  let until = 0
  return async () => {
    if (token && Date.now() < until) return token
    const { access_token, expires_in } = await fetch_token()
    token = access_token
    until = Date.now() + (expires_in - 60) * MS_PER_SECOND
    return token
  }
}

/** On Cloud Run or a Compute Engine VM: the attached service account. */
export const metadata_token = () =>
  cached(async () => {
    const url =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
    const response = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' }
    })
    if (!response.ok) throw new Error(`metadata token: ${response.status}`)
    return response.json()
  })

/** On a laptop: whoever `gcloud auth login` signed in. */
export const gcloud_token = () =>
  cached(async () => {
    const { stdout } = await promisify(exec_file)('gcloud', [
      'auth',
      'print-access-token'
    ])
    return {
      access_token: stdout.trim(),
      expires_in: CLI_TOKEN_MINUTES * SECONDS_PER_MINUTE
    }
  })

/** Every page of an object listing, following `nextPageToken`. */
const pages = async ({
  bucket,
  call,
  fail,
  fields,
  label,
  scope,
  start_offset = ''
}) => {
  const found = []
  const folders = []
  let page = ''
  do {
    const query = new URLSearchParams({ prefix: scope, fields })
    if (start_offset) query.set('startOffset', start_offset)
    if (page) query.set('pageToken', page)
    const response = await call(`${API}/${bucket}/o?${query}`)
    if (!response.ok) await fail(label, response)
    const listed = await response.json()
    found.push(...(listed.items ?? []))
    folders.push(...(listed.prefixes ?? []))
    page = listed.nextPageToken ?? ''
  } while (page)
  return { folders, items: found }
}

export const create_gcs = ({ bucket, token, prefix = '' }) => {
  if (!bucket) throw new Error('create_gcs needs a bucket')
  if (typeof token !== 'function') throw new Error('create_gcs needs token()')
  if (prefix && !prefix.endsWith('/')) throw new Error('prefix must end in /')

  const object = key => encodeURIComponent(`${prefix}${key}`)
  const call = async (url, init = {}) =>
    fetch(url, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${await token()}` }
    })
  const fail = async (what, response) => {
    throw new Error(
      `gcs ${what}: ${response.status} ${(await response.text()).slice(0, HTTP.OK)}`
    )
  }
  const precondition = if_version =>
    if_version === undefined
      ? ''
      : `ifGenerationMatch=${if_version === null ? 0 : encodeURIComponent(if_version)}`

  return {
    async get(key) {
      const response = await call(`${API}/${bucket}/o/${object(key)}?alt=media`)
      if (response.status === HTTP.NOT_FOUND) return null
      if (!response.ok) await fail(`get ${key}`, response)
      const body = Buffer.from(await response.arrayBuffer())
      return { body, version: response.headers.get('x-goog-generation') }
    },

    /**
     * @param {string} key
     * @param {Buffer | string} body
     * @param {import('./contract.js').VersionGuard & import('./contract.js').Packing} [options]
     */
    async put(key, body, { if_version, gzip } = {}) {
      const stored = at_rest(key, body, gzip)
      const query = [
        `uploadType=${stored.encoding ? 'multipart' : 'media'}`,
        stored.encoding ? '' : `name=${object(key)}`,
        precondition(if_version)
      ].filter(Boolean)
      const upload = upload_of(`${prefix}${key}`, body, stored)
      const response = await call(`${UPLOAD}/${bucket}/o?${query.join('&')}`, {
        method: 'POST',
        headers: { 'content-type': upload.type },
        body: upload.body
      })
      if (response.status === HTTP.PRECONDITION_FAILED)
        throw new Conflict(`${key} changed`)
      if (!response.ok) await fail(`put ${key}`, response)
      return String((await response.json()).generation)
    },

    async stat(key) {
      const response = await call(
        `${API}/${bucket}/o/${object(key)}?fields=generation`
      )
      if (response.status === HTTP.NOT_FOUND) return null
      if (!response.ok) await fail(`stat ${key}`, response)
      return String((await response.json()).generation)
    },

    /**
     * Joins sources into key on Google's side; nothing downloads. Every
     * source must be gzip (put with `gzip: true`): the result is marked gzip,
     * and stacked gzip pieces read back as one text.
     */
    /**
     * @param {string} key
     * @param {string[]} sources
     * @param {import('./contract.js').VersionGuard} [options]
     */
    async compose(key, sources, { if_version } = {}) {
      const query = precondition(if_version)
      const response = await call(
        `${API}/${bucket}/o/${object(key)}/compose${query ? `?${query}` : ''}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceObjects: sources.map(name => ({ name: `${prefix}${name}` })),
            destination: { contentEncoding: 'gzip' }
          })
        }
      )
      if (
        response.status === HTTP.PRECONDITION_FAILED ||
        response.status === HTTP.NOT_FOUND
      )
        throw new Conflict(`${key} changed`)
      if (response.status === HTTP.TOO_MANY_REQUESTS)
        throw Object.assign(new Error(`${key} is busy`), { code: 'busy' })
      if (!response.ok) await fail(`compose ${key}`, response)
      return String((await response.json()).generation)
    },

    /**
     * @param {string} key
     * @param {import('./contract.js').VersionGuard} [options]
     */
    async delete(key, { if_version } = {}) {
      const query = precondition(if_version)
      const response = await call(
        `${API}/${bucket}/o/${object(key)}${query ? `?${query}` : ''}`,
        {
          method: 'DELETE'
        }
      )
      if (response.status === HTTP.PRECONDITION_FAILED)
        throw new Conflict(`${key} changed`)
      if (response.status === HTTP.NOT_FOUND) {
        if (typeof if_version === 'string') throw new Conflict(`${key} is gone`)
        return
      }
      if (!response.ok) await fail(`delete ${key}`, response)
    },

    async list(folder) {
      const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
      const { folders, items } = await pages({
        bucket,
        call,
        fail,
        fields: 'items(name),prefixes,nextPageToken',
        label: `list ${folder}`,
        scope
      })
      const files = items.map(item => item.name.slice(scope.length))
      return {
        files: files.filter(Boolean).sort(),
        folders: folders.map(name => name.slice(scope.length, -1)).sort()
      }
    },

    /** File names directly in a folder that sort after `after`, in order. */
    async list_after(folder, after = '') {
      const scope = `${prefix}${folder.replace(/\/?$/, '/')}`
      const { items } = await pages({
        bucket,
        call,
        fail,
        fields: 'items(name),nextPageToken',
        label: `list ${folder}`,
        scope,
        start_offset: after ? `${scope}${after}` : ''
      })
      return items
        .map(item => item.name.slice(scope.length))
        .filter(name => name > after)
        .sort()
    },

    async walk(folder) {
      const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
      const { items } = await pages({
        bucket,
        call,
        fail,
        fields: 'items(name,generation),nextPageToken',
        label: `walk ${folder}`,
        scope
      })
      const found = {}
      for (const item of items) {
        const name = item.name.slice(scope.length)
        if (name && !name.endsWith('/')) found[name] = item.generation
      }
      return found
    },

    /** Like walk, with each file's byte size and last update. */
    async walk_meta(folder) {
      const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
      const { items } = await pages({
        bucket,
        call,
        fail,
        fields:
          'items(name,generation,size,updated,metadata/size),nextPageToken',
        label: `walk ${folder}`,
        scope
      })
      const found = {}
      for (const item of items) {
        const name = item.name.slice(scope.length)
        if (name && !name.endsWith('/'))
          found[name] = {
            version: item.generation,
            size: Number(item.metadata?.size ?? item.size),
            updated: item.updated
          }
      }
      return found
    }
  }
}
