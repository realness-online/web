/**
 * w1: where a vault door reads files. The Mac reads its vault folder; the
 * cloud reads the person's vault in storage. Both list every file with a
 * version, and read one file as text.
 */
import {
  readdir,
  readFile as read_file,
  realpath,
  stat
} from 'node:fs/promises'
import { join, sep } from 'node:path'

/**
 * @typedef {{ version: string, updated: string }} VaultFile
 * @typedef {{ list: () => Promise<Record<string, VaultFile>>, read: (path: string) => Promise<string | null> }} VaultSource
 */

/** Folders that hold no pages a reader opens: the session archive, packages. */
const SKIP = new Set(['Sessions', 'node_modules'])

/**
 * A vault path a source serves: no dot names, no skipped folders.
 * @param {string} path
 */
const is_served = path =>
  !path
    .split('/')
    .some(part => part.startsWith('.') || SKIP.has(part) || part === '')

/**
 * The files under a folder, as vault paths with a version from size and time.
 * @param {string} root
 * @param {string} [folder]
 * @returns {Promise<Record<string, VaultFile>>}
 */
const walk = async (root, folder = '') => {
  const entries = await readdir(join(root, folder), {
    withFileTypes: true
  }).catch(() => [])
  const found = await Promise.all(
    entries.map(async entry => {
      const path = folder ? `${folder}/${entry.name}` : entry.name
      if (!is_served(path)) return {}
      if (entry.isDirectory()) return walk(root, path)
      if (!entry.isFile()) return {}
      const info = await stat(join(root, path)).catch(() => null)
      if (!info) return {}
      return {
        [path]: {
          version: `${info.size}-${info.mtimeMs}`,
          updated: info.mtime.toISOString()
        }
      }
    })
  )
  return Object.assign({}, ...found)
}

/**
 * The Mac's vault folder. A read never leaves the folder, links included.
 * @param {string} dir
 * @returns {VaultSource}
 */
export const disk_source = dir => ({
  list: () => walk(dir),
  async read(path) {
    if (!is_served(path)) return null
    try {
      const root = await realpath(dir)
      const full = await realpath(join(root, path))
      if (!full.startsWith(root + sep)) return null
      return await read_file(full, 'utf8')
    } catch {
      return null
    }
  }
})

/**
 * One person's vault in sync storage, `people/<phone>/vault/`.
 * @param {import('./server.js').SyncStorage} storage
 * @param {string} phone
 * @returns {VaultSource}
 */
export const storage_source = (storage, phone) => {
  const prefix = `people/${phone}/vault/`
  return {
    async list() {
      const listed = await storage.walk_meta(prefix)
      return Object.fromEntries(
        Object.entries(listed)
          .filter(([path]) => is_served(path))
          .map(([path, { version, updated }]) => [path, { version, updated }])
      )
    },
    async read(path) {
      if (!is_served(path)) return null
      const file = await storage.get(`${prefix}${path}`)
      return file ? file.body.toString('utf8') : null
    }
  }
}
