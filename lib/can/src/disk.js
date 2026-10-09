/**
 * Disk storage: the adapter every provider fits.
 *
 *   get(key)                       { body, version } or null
 *   put(key, body, { if_version }) new version
 *   delete(key, { if_version })
 *   list(prefix)                   { files, folders } directly under it
 *   walk(prefix)                   { relative name: version } for every file below
 *   walk_meta(prefix)              { relative name: { version, size, updated } }; updated is ISO
 *   stat(key)                      version, or null when missing
 *   compose(key, sources, { if_version })  key becomes sources' bytes joined
 *
 * `if_version` makes a write conditional: a version string must match, and
 * `null` means the key must not exist yet. A mismatch throws a Conflict.
 * Versions are content hashes, so equal bytes share a version.
 */
import { createHash as create_hash, randomUUID as random_uuid } from "node:crypto"
import { mkdir, readFile as read_file, readdir, rename, rm, stat, writeFile as write_file } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"

export class Conflict extends Error {
  code = "conflict"
}

const version_of = (body) => create_hash("sha256").update(body).digest("base64url").slice(0, 22)
const missing = (error) => ["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)

export const disk = (root) => {
  root = resolve(root)
  const locks = new Map()

  const at = (key) => {
    const path = resolve(root, key)
    if (!path.startsWith(root + sep)) throw new Error(`disk: ${key} escapes the root`)
    return path
  }

  // One writer per key at a time, so conditional writes cannot interleave.
  const serial = (key, work) => {
    const run = (locks.get(key) ?? Promise.resolve()).then(work)
    const settled = run.catch(() => {})
    locks.set(key, settled)
    settled.then(() => locks.get(key) === settled && locks.delete(key))
    return run
  }

  const get = async (key) => {
    try {
      const body = await read_file(at(key))
      return { body, version: version_of(body) }
    } catch (error) {
      if (missing(error)) return null
      throw error
    }
  }

  const check = async (key, if_version) => {
    if (if_version === undefined) return
    const current = (await get(key))?.version ?? null
    if (current !== if_version) throw new Conflict(`${key} is at ${current}`)
  }

  return {
    get,

    put: (key, body, { if_version } = {}) =>
      serial(key, async () => {
        await check(key, if_version)
        const path = at(key)
        await mkdir(dirname(path), { recursive: true })
        const temp = join(dirname(path), `${random_uuid()}.tmp`)
        await write_file(temp, body)
        await rename(temp, path)
        return version_of(body)
      }),

    stat: async (key) => (await get(key))?.version ?? null,

    compose: (key, sources, { if_version } = {}) =>
      serial(key, async () => {
        const files = await Promise.all(sources.map(get))
        const gone = sources.find((_, i) => !files[i])
        if (gone) throw new Conflict(`${gone} is missing`)
        await check(key, if_version)
        const body = Buffer.concat(files.map((file) => file.body))
        const path = at(key)
        await mkdir(dirname(path), { recursive: true })
        const temp = join(dirname(path), `${random_uuid()}.tmp`)
        await write_file(temp, body)
        await rename(temp, path)
        return version_of(body)
      }),

    delete: (key, { if_version } = {}) =>
      serial(key, async () => {
        await check(key, if_version)
        await rm(at(key), { force: true })
      }),

    async list(prefix) {
      const trimmed = prefix.replace(/\/$/, "")
      let entries
      try {
        entries = await readdir(trimmed ? at(trimmed) : root, { withFileTypes: true })
      } catch (error) {
        if (missing(error)) return { files: [], folders: [] }
        throw error
      }
      const shown = entries.filter((entry) => !entry.name.endsWith(".tmp"))
      const names = (test) => shown.filter(test).map((entry) => entry.name).sort()
      return { files: names((e) => e.isFile()), folders: names((e) => e.isDirectory()) }
    },

    /** File names directly in a folder that sort after `after`, in order. */
    async list_after(folder, after = "") {
      return (await this.list(folder)).files.filter((name) => name > after)
    },

    async walk(prefix) {
      const folder = prefix.replace(/\/?$/, "/").replace(/^\/$/, "")
      const found = {}
      const visit = async (under) => {
        const { files, folders } = await this.list(`${folder}${under}`)
        for (const name of files) found[`${under}${name}`] = (await get(`${folder}${under}${name}`)).version
        for (const name of folders) await visit(`${under}${name}/`)
      }
      await visit("")
      return found
    },

    async walk_meta(prefix) {
      const folder = prefix.replace(/\/?$/, "/").replace(/^\/$/, "")
      const found = {}
      for (const [name, version] of Object.entries(await this.walk(prefix))) {
        const info = await stat(at(`${folder}${name}`))
        found[name] = { version, size: info.size, updated: info.mtime.toISOString() }
      }
      return found
    },
  }
}
