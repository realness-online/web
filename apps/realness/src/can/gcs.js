/**
 * Google Cloud Storage over its JSON API: plain fetch, no dependencies.
 *
 *   create_gcs({ bucket, token, prefix })
 *
 * `token()` resolves to an OAuth access token: `metadata_token()` on Cloud
 * Run, `gcloud_token()` on a laptop. `prefix` scopes every key, so tests can
 * run inside a throwaway folder. A version is `version_of` the plain bytes,
 * worked out on put and kept in the object's metadata; a composed object,
 * joined on Google's side, falls back to its CRC32C. A guarded write reads
 * the object's version and generation, then writes on that generation, so
 * the check stays atomic. `meta` is the object's own metadata.
 *
 * Text keys are stored gzip (`contentEncoding`). Fetch decodes on the way
 * out, so `get` returns exactly what `put` was given.
 */
import { randomUUID as random_uuid } from 'node:crypto'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from 'node:zlib'
import { guard } from './disk.js'
import { Conflict } from './contract.js'
import { merged_meta } from './contract.js'
import { hash_index, index_scope } from './hash-index.js'
import { version_of as hash_of } from '#root/src/files/version.js'
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

/** The adapter's own metadata keys: the plain size and the plain hash. */
const SIZE = 'size'
const VERSION = 'version'

/** An object's version: ours from metadata, or CRC32C once composed. */
const version_of = object =>
  object.metadata?.[VERSION] ??
  (object.crc32c ? `crc32c-${object.crc32c}` : null)

/** The caller's meta, without the adapter's own keys. */
const meta_of = object => {
  const meta = { ...object.metadata }
  delete meta[SIZE]
  delete meta[VERSION]
  return meta
}

/** The upload for one stored body, its plain size and version in metadata. */
const upload_of = (name, plain, stored, version, meta = {}) =>
  multipart(
    {
      name,
      ...(stored.encoding && { contentEncoding: stored.encoding }),
      metadata: {
        ...meta,
        [VERSION]: version,
        ...(stored.encoding && { [SIZE]: String(Buffer.byteLength(plain)) })
      }
    },
    stored.body
  )

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

/**
 * Every page of an object listing, following `nextPageToken`.
 * @param {{ bucket: string, call: Function, fail: Function, fields: string, label: string, scope: string, delimiter?: string }} options
 */
const pages = async ({
  bucket,
  call,
  fail,
  fields,
  label,
  scope,
  delimiter
}) => {
  const found = []
  const folders = []
  let page = ''
  do {
    const query = new URLSearchParams({ prefix: scope, fields })
    if (delimiter) query.set('delimiter', delimiter)
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

/** Index pieces live under `.index/`, beside every scope, never inside one. */
const INDEX = '.index/'
const hidden = name => name.startsWith(INDEX)

/** The hash index, kept as JSON pieces in the bucket. */
const gcs_index = ({ bucket, call, fail, object }) =>
  hash_index({
    async read(piece) {
      const response = await call(
        `${API}/${bucket}/o/${object(`${INDEX}${piece}`)}?alt=media`
      )
      if (response.status === HTTP.NOT_FOUND)
        return { entries: {}, generation: '0' }
      if (!response.ok) await fail(`index ${piece}`, response)
      return {
        entries: await response.json(),
        generation: response.headers.get('x-goog-generation') ?? '0'
      }
    },
    async write(piece, entries, generation) {
      const name = object(`${INDEX}${piece}`)
      const match = `ifGenerationMatch=${encodeURIComponent(String(generation))}`
      const response = Object.keys(entries).length
        ? await call(
            `${UPLOAD}/${bucket}/o?uploadType=media&name=${name}&${match}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(entries)
            }
          )
        : await call(`${API}/${bucket}/o/${name}?${match}`, {
            method: 'DELETE'
          })
      if (
        response.status === HTTP.PRECONDITION_FAILED ||
        (response.status === HTTP.NOT_FOUND && generation !== '0')
      )
        throw new Conflict(`${piece} moved`)
      if (!response.ok && response.status !== HTTP.NOT_FOUND)
        await fail(`index ${piece}`, response)
    }
  })

/** list, walk, and walk_meta over the bucket, hiding the index. */
const gcs_listing = ({ bucket, call, fail, prefix }) => ({
  async list(folder) {
    const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
    const { folders, items } = await pages({
      bucket,
      call,
      fail,
      fields: 'items(name),prefixes,nextPageToken',
      label: `list ${folder}`,
      delimiter: '/',
      scope
    })
    const files = items
      .filter(item => !hidden(item.name.slice(prefix.length)))
      .map(item => item.name.slice(scope.length))
    return {
      files: files.filter(Boolean).sort(),
      folders: folders
        .filter(name => !hidden(name.slice(prefix.length)))
        .map(name => name.slice(scope.length, -1))
        .sort()
    }
  },

  async walk(folder) {
    const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
    const { items } = await pages({
      bucket,
      call,
      fail,
      fields: 'items(name,crc32c,metadata),nextPageToken',
      label: `walk ${folder}`,
      scope
    })
    const found = {}
    for (const item of items) {
      const name = item.name.slice(scope.length)
      if (
        name &&
        !name.endsWith('/') &&
        !hidden(item.name.slice(prefix.length))
      )
        found[name] = version_of(item)
    }
    return found
  },

  /** Like walk, with each file's byte size, last update, and meta. */
  async walk_meta(folder) {
    const scope = `${prefix}${folder.replace(/\/?$/, '/').replace(/^\/$/, '')}`
    const { items } = await pages({
      bucket,
      call,
      fail,
      fields: 'items(name,crc32c,size,updated,metadata),nextPageToken',
      label: `walk ${folder}`,
      scope
    })
    const found = {}
    for (const item of items) {
      const name = item.name.slice(scope.length)
      if (
        name &&
        !name.endsWith('/') &&
        !hidden(item.name.slice(prefix.length))
      )
        found[name] = {
          version: version_of(item),
          size: Number(item.metadata?.[SIZE] ?? item.size),
          updated: item.updated,
          meta: meta_of(item)
        }
    }
    return found
  }
})

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
  /** The object's generation, hashes, and metadata, or null. */
  const head = async key => {
    const response = await call(
      `${API}/${bucket}/o/${object(key)}?fields=generation,crc32c,metadata`
    )
    if (response.status === HTTP.NOT_FOUND) return null
    if (!response.ok) await fail(`stat ${key}`, response)
    return response.json()
  }

  /**
   * The bucket's precondition for a guard: our hash, pinned to a generation.
   * Without a guard the write is pinned to the object it read, so a merged
   * `created` never lands on top of a write it did not see.
   */
  const precondition = (key, options, current) => {
    const { if_version, if_absent } = guard(options)
    if (if_absent) return 'ifGenerationMatch=0'
    if (
      if_version !== undefined &&
      (!current || version_of(current) !== if_version)
    )
      throw new Conflict(`${key} changed`)
    return `ifGenerationMatch=${encodeURIComponent(current?.generation ?? 0)}`
  }

  const index = gcs_index({ bucket, call, fail, object })

  return {
    /** Every key under a person's scope holding `version`. */
    find: (scope, version) => index.find(scope, version),

    async get(key) {
      const current = await head(key)
      if (!current) return null
      const response = await call(
        `${API}/${bucket}/o/${object(key)}?alt=media&generation=${encodeURIComponent(current.generation)}`
      )
      if (response.status === HTTP.NOT_FOUND) return null
      if (!response.ok) await fail(`get ${key}`, response)
      const body = Buffer.from(await response.arrayBuffer())
      return { body, version: version_of(current), meta: meta_of(current) }
    },

    /**
     * @param {string} key
     * @param {Buffer | string} body
     * @param {import('./contract.js').VersionGuard & import('./contract.js').Packing & import('./contract.js').Described} [options]
     */
    async put(key, body, options = {}) {
      const sent_gzip = options.encoding === 'gzip'
      const plain = sent_gzip ? gunzip_sync(body) : Buffer.from(body)
      const version = await hash_of(plain)
      const stored = sent_gzip
        ? { body: Buffer.from(body), encoding: 'gzip' }
        : at_rest(key, plain, options.gzip)
      const current = options.if_absent ? null : await head(key)
      const upload = upload_of(
        `${prefix}${key}`,
        plain,
        stored,
        version,
        merged_meta(current ? meta_of(current) : {}, options.meta)
      )
      const query = [
        'uploadType=multipart',
        await precondition(key, options, current)
      ].filter(Boolean)
      const response = await call(`${UPLOAD}/${bucket}/o?${query.join('&')}`, {
        method: 'POST',
        headers: { 'content-type': upload.type },
        body: upload.body
      })
      if (response.status === HTTP.PRECONDITION_FAILED)
        throw new Conflict(`${key} changed`)
      if (!response.ok) await fail(`put ${key}`, response)
      if (index_scope(key))
        await index.moved(key, current ? version_of(current) : null, version)
      return version
    },

    async stat(key) {
      const current = await head(key)
      return current ? version_of(current) : null
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
    async compose(key, sources, options = {}) {
      const { if_version, if_absent } = guard(options)
      const query =
        if_version === undefined && !if_absent
          ? ''
          : await precondition(key, options, if_absent ? null : await head(key))
      const response = await call(
        `${API}/${bucket}/o/${object(key)}/compose${query ? `?${query}` : ''}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceObjects: sources.map(name => ({
              name: `${prefix}${name}`
            })),
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
      return version_of(await response.json())
      // Composed keys are usage logs, outside every index scope.
    },

    /**
     * @param {string} key
     * @param {import('./contract.js').VersionGuard} [options]
     */
    async delete(key, options = {}) {
      const current =
        options.if_version !== undefined || index_scope(key)
          ? await head(key)
          : null
      const query =
        options.if_version === undefined
          ? ''
          : await precondition(key, options, current)
      const response = await call(
        `${API}/${bucket}/o/${object(key)}${query ? `?${query}` : ''}`,
        {
          method: 'DELETE'
        }
      )
      if (response.status === HTTP.PRECONDITION_FAILED)
        throw new Conflict(`${key} changed`)
      if (response.status === HTTP.NOT_FOUND) {
        if (options.if_version !== undefined)
          throw new Conflict(`${key} is gone`)
        return
      }
      if (!response.ok) await fail(`delete ${key}`, response)
      if (current && index_scope(key))
        await index.moved(key, version_of(current), null)
    },

    ...gcs_listing({ bucket, call, fail, prefix })
  }
}
