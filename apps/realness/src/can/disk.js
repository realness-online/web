/**
 * Disk storage: the adapter every provider fits.
 *
 *   get(key)                       { body, version, meta } or null
 *   put(key, body, { if_version, if_absent, meta })  new version
 *   delete(key, { if_version })
 *   list(prefix)                   { files, folders } directly under it
 *   walk(prefix)                   { relative name: version } for every file below
 *   walk_meta(prefix)              { relative name: { version, size, updated, meta } }; updated is ISO
 *   stat(key)                      version, or null when missing
 *   compose(key, sources, { if_version, if_absent })  key becomes sources' bytes joined
 *
 * The bytes are the truth: a version is their hash, never stored. A body
 * sent with `encoding: 'gzip'` is unpacked before it lands. A `.gz` key is
 * gzip at rest: a gzip body is kept as sent, a plain one is zipped, reads
 * unpack it, its version is the plain bytes' hash, and
 * `get(key, { raw: true })` hands back the stored bytes.
 * Conflict checks hash the bytes at write time; listings reuse a hash while
 * the stored file's size and mtime hold, so they read no bodies.
 *
 * `meta` is what we know about the data that its bytes cannot say. It lives
 * under `.meta/`, which listings hide, and a write replaces it.
 */
import { randomUUID as random_uuid } from 'node:crypto'
import {
  mkdir,
  readFile as read_file,
  readdir,
  rename,
  rm,
  stat,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { gzipSync as gzip_sync, gunzipSync as gunzip_sync } from 'node:zlib'
import { version_of } from '#root/src/files/version.js'
import { Conflict, merged_meta } from './contract.js'
import { hash_index, index_scope } from './hash-index.js'
/* eslint-disable no-await-in-loop -- tree walks go one entry at a time to bound open files */

/**
 * A write's preconditions, checked for shape. `if_version: null` was the old
 * create-only spelling; `if_absent: true` says it now.
 * @param {import('./contract.js').VersionGuard} [options]
 */
export const guard = ({ if_version, if_absent } = {}) => {
  if (if_version === null)
    throw new TypeError('if_version: null is gone; use if_absent: true')
  if (if_absent && if_version !== undefined)
    throw new TypeError('if_absent and if_version exclude each other')
  return { if_version, if_absent: Boolean(if_absent) }
}

const META = '.meta'
const INDEX = '.index'
const RESERVED = [META, INDEX]
const missing = error => ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)

const GZIP_MAGIC = Buffer.from('1f8b', 'hex')
const GZ = /\.gz$/

/** Unpack a `.gz` body; others pass through. */
const to_plain = (key, body) =>
  GZ.test(key) && body.subarray(0, 2).equals(GZIP_MAGIC)
    ? gunzip_sync(body)
    : body

/** The path for a key, refusing escapes and the reserved folders. */
const path_in = (root, key) => {
  const path = resolve(root, key)
  if (!path.startsWith(root + sep))
    throw new Error(`disk: ${key} escapes the root`)
  const reserved = name =>
    path === join(root, name) || path.startsWith(join(root, name) + sep)
  if (RESERVED.some(reserved)) throw new Error(`disk: ${key} is reserved`)
  return path
}

/** Runs work for one key at a time, in arrival order. */
const serializer = () => {
  const locks = new Map()
  return (key, work) => {
    const run = (locks.get(key) ?? Promise.resolve()).then(work)
    const settled = run.catch(() => {})
    locks.set(key, settled)
    settled.then(() => locks.get(key) === settled && locks.delete(key))
    return run
  }
}

/** Writes beside the target, then renames over it. */
const atomic_write = async (path, data) => {
  await mkdir(dirname(path), { recursive: true })
  const temp = join(dirname(path), `${random_uuid()}.tmp`)
  await write_file(temp, data)
  await rename(temp, path)
}

/** JSON from a file, or `{}` when it is missing. */
const read_json = async path => {
  try {
    return JSON.parse(await read_file(path, 'utf8'))
  } catch (error) {
    if (missing(error)) return {}
    throw error
  }
}

/** A folder's direct files and folders, hiding temp files and reserved ones. */
const list_in = async (root, at, prefix) => {
  const trimmed = prefix.replace(/\/$/, '')
  let entries
  try {
    entries = await readdir(trimmed ? at(trimmed) : root, {
      withFileTypes: true
    })
  } catch (error) {
    if (missing(error)) return { files: [], folders: [] }
    throw error
  }
  const shown = entries.filter(
    entry =>
      !entry.name.endsWith('.tmp') &&
      !(!trimmed && RESERVED.includes(entry.name))
  )
  const names = test =>
    shown
      .filter(test)
      .map(entry => entry.name)
      .sort()
  return {
    files: names(e => e.isFile()),
    folders: names(e => e.isDirectory())
  }
}

export const disk = root_path => {
  const root = resolve(root_path)
  const serial = serializer()
  /** @type {Map<string, { size: number, mtime: number, version: string }>} */
  const hashes = new Map()

  const at = key => path_in(root, key)
  const meta_at = key => `${join(root, META, key)}.json`

  const read_meta = key => read_json(meta_at(key))
  const write_meta = (key, meta) =>
    meta && Object.keys(meta).length
      ? atomic_write(meta_at(key), JSON.stringify(meta))
      : rm(meta_at(key), { force: true })

  /** @param {string} key @param {{ raw?: boolean }} [options] */
  const get = async (key, { raw = false } = {}) => {
    try {
      const stored = await read_file(at(key))
      const body = to_plain(key, stored)
      const packed = body !== stored
      return {
        body: raw ? stored : body,
        ...(raw && { packed }),
        version: await version_of(body),
        meta: await read_meta(key)
      }
    } catch (error) {
      if (missing(error)) return null
      throw error
    }
  }

  /** The hash while size and mtime hold; otherwise read the bytes again. */
  const listed_version = async (key, info) => {
    const known = hashes.get(key)
    if (known && known.size === info.size && known.mtime === info.mtimeMs)
      return known.version
    const plain = to_plain(key, await read_file(at(key)))
    const version = await version_of(plain)
    hashes.set(key, { size: info.size, mtime: info.mtimeMs, version })
    return version
  }

  /** A piece's text is its generation: a write lands only on what it read. */
  const read_piece = async piece => {
    try {
      const text = await read_file(join(root, INDEX, piece), 'utf8')
      return { entries: JSON.parse(text), generation: text }
    } catch (error) {
      if (missing(error)) return { entries: {}, generation: null }
      throw error
    }
  }
  const index = hash_index({
    read: read_piece,
    exclusive: (piece, work) => serial(`${INDEX}/${piece}`, work),
    async write(piece, entries, generation) {
      const path = join(root, INDEX, piece)
      if ((await read_piece(piece)).generation !== generation)
        throw new Conflict(`${piece} moved`)
      if (!Object.keys(entries).length) return rm(path, { force: true })
      await atomic_write(path, JSON.stringify(entries))
    }
  })
  /** The stored version before a change, read only for indexed keys. */
  const before = async key => {
    if (!index_scope(key)) return null
    const info = await stat(at(key)).catch(() => null)
    return info ? listed_version(key, info) : null
  }

  /** Hashes the bytes on disk now; the cache never decides a conflict. */
  const check = async (key, options) => {
    const { if_version, if_absent } = guard(options)
    if (if_version === undefined && !if_absent) return
    const current = (await get(key))?.version ?? null
    if (if_absent && current !== null) throw new Conflict(`${key} exists`)
    if (if_version !== undefined && current !== if_version)
      throw new Conflict(`${key} is at ${current}`)
  }

  /**
   * `sent` is the gzip a client sent for a `.gz` key, kept as it came.
   * @param {string} key
   * @param {Buffer | string} body
   * @param {Record<string, string>} [meta]
   * @param {Buffer | null} [sent]
   */
  const write = async (key, body, meta, sent = null) => {
    const stored = GZ.test(key) ? (sent ?? gzip_sync(Buffer.from(body))) : body
    await atomic_write(at(key), stored)
    if (meta !== undefined) await write_meta(key, meta)
    return version_of(Buffer.from(body))
  }

  return {
    get,

    /**
     * @param {string} key
     * @param {Buffer | string} body
     * @param {import('./contract.js').VersionGuard & import('./contract.js').Packing & import('./contract.js').Described} [options]
     */
    put: (key, body, options = {}) =>
      serial(key, async () => {
        await check(key, options)
        const sent_gzip = options.encoding === 'gzip'
        const plain = sent_gzip ? gunzip_sync(body) : body
        const meta = merged_meta(await read_meta(key), options.meta)
        const old = await before(key)
        const version = await write(
          key,
          plain,
          meta,
          sent_gzip ? Buffer.from(body) : null
        )
        await index.moved(key, old, version)
        return version
      }),

    /** Every key under a person's scope holding `version`. */
    find: (scope, version) => index.find(scope, version),

    stat: async key => (await get(key))?.version ?? null,

    /**
     * @param {string} key
     * @param {string[]} sources
     * @param {import('./contract.js').VersionGuard} [options]
     */
    compose: (key, sources, options = {}) =>
      serial(key, async () => {
        const files = await Promise.all(sources.map(source => get(source)))
        const gone = sources.find((name, index) => !files[index])
        if (gone) throw new Conflict(`${gone} is missing`)
        await check(key, options)
        const old = await before(key)
        const version = await write(
          key,
          Buffer.concat(files.flatMap(file => (file ? [file.body] : [])))
        )
        await index.moved(key, old, version)
        return version
      }),

    /**
     * @param {string} key
     * @param {import('./contract.js').VersionGuard} [options]
     */
    delete: (key, options = {}) =>
      serial(key, async () => {
        await check(key, options)
        const old = await before(key)
        await rm(at(key), { force: true })
        await rm(meta_at(key), { force: true })
        hashes.delete(key)
        await index.moved(key, old, null)
      }),

    list: prefix => list_in(root, at, prefix),

    async walk(prefix) {
      const listed = await this.walk_meta(prefix)
      return Object.fromEntries(
        Object.entries(listed).map(([name, { version }]) => [name, version])
      )
    },

    async walk_meta(prefix) {
      const folder = prefix.replace(/\/?$/, '/').replace(/^\/$/, '')
      const found = {}
      const visit = async under => {
        const { files, folders } = await this.list(`${folder}${under}`)
        for (const name of files) {
          const key = `${folder}${under}${name}`
          let info
          try {
            info = await stat(at(key))
          } catch (error) {
            if (missing(error)) continue
            throw error
          }
          found[`${under}${name}`] = {
            version: await listed_version(key, info),
            size: info.size,
            updated: info.mtime.toISOString(),
            meta: await read_meta(key)
          }
        }
        for (const name of folders) await visit(`${under}${name}/`)
      }
      await visit('')
      return found
    }
  }
}
