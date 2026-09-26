/**
 * A gsutil-like client for the sync service. Every call carries the phone
 * token and passes `can()`; nothing here touches storage directly.
 *
 *   can://people/+1…/vault/note.md   a remote path
 *   can://~/vault/note.md            the same, for whoever the token names
 *
 * `sync` is two-way. `.can-sync.json` holds the base: each file's hash and
 * remote version at the last agreement. A side that moved from the base wins.
 * Both moving: text merges three ways against the copy in `.can-base/`; when
 * edits overlap, or for binaries, theirs lands beside ours as `x.conflict.ext`
 * and both travel. An edit beats a delete. A remote change mid-run is left
 * for the next run and reported as a conflict.
 */
import { execFile } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { promisify } from "node:util"

const run = promisify(execFile)
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join, relative, sep } from "node:path"
import { skipped_name } from "./skip.js"

/** The development sync service, unless SYNC_URL says otherwise. */
export const SYNC_URL = process.env.SYNC_URL ?? "https://brayness-sync-639469569733.us-central1.run.app"

const MANIFEST = ".can-sync.json"
const BASE = ".can-base"
const TEXT_LIMIT = 1024 * 1024

/** Small files with no NUL byte are text, and worth a base copy. */
export const is_text = (bytes) => bytes.length <= TEXT_LIMIT && !bytes.subarray(0, 8000).includes(0)

export class SyncError extends Error {
  constructor(status, what) {
    super(`${what}: ${status}`)
    this.status = status
  }
}

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")

/** The phone number a token names, read locally only to build paths. */
export function phone_of(token) {
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url")).phone_number ?? null
  } catch {
    return null
  }
}

export const is_remote = (path) => path.startsWith("can://")

export function client({ url, token, fetcher = fetch }) {
  const me = phone_of(token)

  const key = (path) => {
    let rest = path.replace(/^can:\/\//, "")
    if (rest === "~" || rest.startsWith("~/")) {
      if (!me) throw new Error("can://~ needs a token with a phone number")
      rest = `people/${me}${rest.slice(1)}`
    }
    return rest
  }

  const call = async (method, path, { body, headers = {}, query = "" } = {}) => {
    const auth = token ? { authorization: `Bearer ${token}` } : {}
    const encoded = key(path).split("/").map(encodeURIComponent).join("/")
    return fetcher(`${url}/${encoded}${query && `?${query}`}`, { method, body, headers: { ...auth, ...headers } })
  }

  const expect = async (response, what, ok = [200]) => {
    if (!ok.includes(response.status)) throw new SyncError(response.status, what)
    return response
  }

  const api = {
    me,
    key,

    async ls(path) {
      const folder = path.endsWith("/") ? path : `${path}/`
      const response = await expect(await call("GET", folder), `ls ${path}`)
      const { files, folders } = await response.json()
      return [...folders.map((name) => `${name}/`), ...files]
    },

    async cat(path) {
      const response = await expect(await call("GET", path), `cat ${path}`)
      return Buffer.from(await response.arrayBuffer())
    },

    async put(path, bytes, headers = {}) {
      const response = await expect(await call("PUT", path, { body: bytes, headers }), `put ${path}`)
      return response.headers.get("etag")?.replace(/"/g, "")
    },

    async rm(path) {
      await expect(await call("DELETE", path), `rm ${path}`, [204])
    },

    /** Local file to remote, or remote file to local. Folders take the basename. */
    async cp(from, to) {
      if (is_remote(from) === is_remote(to)) throw new Error("cp copies between local and can://")
      if (!is_remote(from)) {
        const target = to.endsWith("/") ? `${to}${basename(from)}` : to
        await api.put(target, await readFile(from))
        return target
      }
      let target = to
      if (to.endsWith(sep) || to.endsWith("/") || (await is_dir(to))) target = join(to, basename(key(from)))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, await api.cat(from))
      return target
    },

    /** Every remote file below a folder, name to version. */
    async walk(path) {
      const folder = path.endsWith("/") ? path : `${path}/`
      return (await expect(await call("GET", folder, { query: "deep" }), `walk ${path}`)).json()
    },

    /** Two-way: whichever side moved from the base wins; both moving is a conflict. */
    async sync(local, remote, { concurrency = 8 } = {}) {
      const folder = remote.endsWith("/") ? remote : `${remote}/`
      const manifest_path = join(local, MANIFEST)
      const manifest = JSON.parse(await readFile(manifest_path, "utf8").catch(() => "{}"))
      const report = {
        pushed: [], pulled: [], deleted: [], removed: [], adopted: [], merged: [], kept_both: [], unchanged: [], conflicts: [],
      }

      const locals = new Map()
      for (const file of await walk(local).catch(() => [])) locals.set(relative(local, file).split(sep).join("/"), file)
      const remotes = await api.walk(folder)
      const names = new Set([...locals.keys(), ...Object.keys(remotes), ...Object.keys(manifest)])

      const agree = async (name, bytes, version) => {
        manifest[name] = { sha: sha(bytes), version }
        const copy = join(local, BASE, name)
        if (is_text(bytes)) {
          await mkdir(dirname(copy), { recursive: true })
          await writeFile(copy, bytes)
        } else await rm(copy, { force: true })
      }
      const forget = async (name) => {
        delete manifest[name]
        await rm(join(local, BASE, name), { force: true })
      }
      const fetch_remote = async (name) => {
        const response = await expect(await call("GET", `${folder}${name}`), `get ${name}`, [200, 404])
        if (response.status === 404) return null
        return { bytes: Buffer.from(await response.arrayBuffer()), version: version_of(response) }
      }
      const pull = async (name, theirs) => {
        const target = join(local, name)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, theirs.bytes)
        await agree(name, theirs.bytes, theirs.version)
      }
      const conditional = (base) => (base ? { "if-match": `"${base.version}"` } : { "if-none-match": "*" })

      const one = async (name) => {
        const base = manifest[name]
        const file = locals.get(name)
        const bytes = file ? await readFile(file) : null
        const local_sha = bytes ? sha(bytes) : null
        const remote_version = remotes[name] ?? null
        const local_moved = local_sha !== (base?.sha ?? null)
        const remote_moved = remote_version !== (base?.version ?? null)

        try {
          if (!local_moved && !remote_moved) return report.unchanged.push(name)
          if (local_moved && !remote_moved) {
            if (!bytes) {
              await expect(await call("DELETE", `${folder}${name}`, { headers: conditional(base) }), `rm ${name}`, [204])
              await forget(name)
              return report.deleted.push(name)
            }
            await agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(base)))
            return report.pushed.push(name)
          }
          if (!local_moved && remote_moved) {
            if (!remote_version) {
              await rm(join(local, name), { force: true })
              await forget(name)
              return report.removed.push(name)
            }
            const theirs = await fetch_remote(name)
            if (!theirs) return report.conflicts.push(name)
            await pull(name, theirs)
            return report.pulled.push(name)
          }
          // Both moved. The same bytes, or both gone, is agreement; an edit beats a delete.
          const theirs = remote_version ? await fetch_remote(name) : null
          if (!bytes && !theirs) return forget(name)
          if (!bytes) {
            await pull(name, theirs)
            return report.pulled.push(name)
          }
          if (!theirs) {
            await agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(null)))
            return report.pushed.push(name)
          }
          if (sha(theirs.bytes) === local_sha) {
            await agree(name, bytes, theirs.version)
            return report.adopted.push(name)
          }
          const ancestor = base && (await readFile(join(local, BASE, name)).catch(() => null))
          const merged = ancestor && is_text(bytes) && is_text(theirs.bytes) && (await merge(local, bytes, ancestor, theirs.bytes))
          if (merged) {
            await writeFile(join(local, name), merged)
            await agree(name, merged, await api.put(`${folder}${name}`, merged, conditional(theirs)))
            return report.merged.push(name)
          }
          // Keep both: theirs lands beside ours under a new name, both travel.
          const copy = conflict_name(name, (taken) => locals.has(taken) || taken in remotes)
          locals.set(copy, join(local, copy))
          await writeFile(join(local, copy), theirs.bytes)
          await agree(copy, theirs.bytes, await api.put(`${folder}${copy}`, theirs.bytes, conditional(null)))
          await agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(theirs)))
          report.kept_both.push(name)
        } catch (error) {
          // The remote moved while we worked: a conflict for the next run.
          if (error.status !== 412) throw error
          report.conflicts.push(name)
        }
      }

      const all = [...names].sort()
      for (let i = 0; i < all.length; i += concurrency) await Promise.all(all.slice(i, i + concurrency).map(one))
      await writeFile(manifest_path, `${JSON.stringify(manifest, null, 2)}\n`)
      for (const list of Object.values(report)) list.sort()
      return report
    },
  }
  return api
}

/** `note.md` becomes `note.conflict.md`, then `note.conflict-2.md`, until one is free. */
export function conflict_name(name, taken) {
  const slash = name.lastIndexOf("/") + 1
  const dot = name.indexOf(".", slash + 1)
  const [stem, ext] = dot === -1 ? [name, ""] : [name.slice(0, dot), name.slice(dot)]
  for (let n = 1; ; n++) {
    const candidate = `${stem}.conflict${n === 1 ? "" : `-${n}`}${ext}`
    if (!taken(candidate)) return candidate
  }
}

/** A clean three-way merge by `git merge-file`, or null when edits overlap. */
async function merge(local, ours, base, theirs) {
  const dir = join(local, BASE, ".merge", randomUUID())
  await mkdir(dir, { recursive: true })
  const [o, b, t] = ["ours", "base", "theirs"].map((name) => join(dir, name))
  try {
    await Promise.all([writeFile(o, ours), writeFile(b, base), writeFile(t, theirs)])
    const { stdout } = await run("git", ["merge-file", "-p", o, b, t], { encoding: "buffer", maxBuffer: 4 * TEXT_LIMIT })
    return stdout
  } catch (error) {
    if (Number.isInteger(error.code) && error.code > 0) return null
    throw error
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const version_of = (response) => response.headers.get("etag")?.replace(/"/g, "")

async function is_dir(path) {
  return (await stat(path).catch(() => null))?.isDirectory() ?? false
}

async function walk(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skipped_name(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await walk(path)))
    else if (entry.isFile()) found.push(path)
  }
  return found.sort()
}
