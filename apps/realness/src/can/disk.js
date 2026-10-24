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
 * The bytes are the truth: a version is their hash, never stored. Conflict
 * checks hash the bytes on disk at write time; listings reuse a hash while
 * the file's size and mtime hold, so they read no bodies.
 *
 * `meta` is what we know about the data that its bytes cannot say. It lives
 * under `.meta/`, which listings hide, and a write replaces it.
 */
import {
  createHash as create_hash,
  randomUUID as random_uuid
} from 'node:crypto'
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
/* eslint-disable no-await-in-loop -- tree walks go one entry at a time to bound open files */

export class Conflict extends Error {
  code = 'conflict'
}

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

const VERSION_LENGTH = 22
const META = '.meta'

const version_of = body =>
  create_hash('sha256')
    .update(body)
    .digest('base64url')
    .slice(0, VERSION_LENGTH)
const missing = error => ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)

export const disk = root_path => {
  const root = resolve(root_path)
  const locks = new Map()
  /** @type {Map<string, { size: number, mtime: number, version: string }>} */
  const hashes = new Map()

  const at = key => {
    const path = resolve(root, key)
    if (!path.startsWith(root + sep))
      throw new Error(`disk: ${key} escapes the root`)
    if (path.startsWith(join(root, META) + sep) || path === join(root, META))
      throw new Error(`disk: ${key} is reserved`)
    return path
  }
  const meta_at = key => `${join(root, META, key)}.json`

  const serial = (key, work) => {
    const run = (locks.get(key) ?? Promise.resolve()).then(work)
    const settled = run.catch(() => {})
    locks.set(key, settled)
    settled.then(() => locks.get(key) === settled && locks.delete(key))
    return run
  }

  const read_meta = async key => {
    try {
      return JSON.parse(await read_file(meta_at(key), 'utf8'))
    } catch (error) {
      if (missing(error)) return {}
      throw error
    }
  }

  const write_meta = async (key, meta) => {
    const path = meta_at(key)
    if (!meta || !Object.keys(meta).length) return rm(path, { force: true })
    await mkdir(dirname(path), { recursive: true })
    const temp = join(dirname(path), `${random_uuid()}.tmp`)
    await write_file(temp, JSON.stringify(meta))
    await rename(temp, path)
  }

  const get = async key => {
    try {
      const body = await read_file(at(key))
      return { body, version: version_of(body), meta: await read_meta(key) }
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
    const version = version_of(await read_file(at(key)))
    hashes.set(key, { size: info.size, mtime: info.mtimeMs, version })
    return version
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

  const write = async (key, body, meta) => {
    const path = at(key)
    await mkdir(dirname(path), { recursive: true })
    const temp = join(dirname(path), `${random_uuid()}.tmp`)
    await write_file(temp, body)
    await rename(temp, path)
    if (meta !== undefined) await write_meta(key, meta)
    return version_of(body)
  }

  return {
    get,

    /**
     * @param {string} key
     * @param {Buffer | string} body
     * @param {import('./contract.js').VersionGuard & import('./contract.js').Described} [options]
     */
    put: (key, body, options = {}) =>
      serial(key, async () => {
        await check(key, options)
        return write(key, body, options.meta ?? {})
      }),

    stat: async key => (await get(key))?.version ?? null,

    /**
     * @param {string} key
     * @param {string[]} sources
     * @param {import('./contract.js').VersionGuard} [options]
     */
    compose: (key, sources, options = {}) =>
      serial(key, async () => {
        const files = await Promise.all(sources.map(get))
        const gone = sources.find((name, index) => !files[index])
        if (gone) throw new Conflict(`${gone} is missing`)
        await check(key, options)
        return write(
          key,
          Buffer.concat(files.flatMap(file => (file ? [file.body] : [])))
        )
      }),

    /**
     * @param {string} key
     * @param {import('./contract.js').VersionGuard} [options]
     */
    delete: (key, options = {}) =>
      serial(key, async () => {
        await check(key, options)
        await rm(at(key), { force: true })
        await rm(meta_at(key), { force: true })
        hashes.delete(key)
      }),

    async list(prefix) {
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
          !entry.name.endsWith('.tmp') && !(!trimmed && entry.name === META)
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
    },

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
