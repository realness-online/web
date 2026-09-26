/**
 * A gsutil-like client for the sync service. Every call carries the phone
 * token and passes `can()`; nothing here touches storage directly.
 *
 *   can://people/+1…/vault/note.md   a remote path
 *   can://~/vault/note.md            the same, for whoever the token names
 *
 * `sync` is two-way and never merges. A record outside the folder holds each
 * file's hash and remote version at the last agreement. A side that moved
 * from it wins. Both moving keeps both: theirs lands beside ours as
 * `x.conflict.ext`, and both travel. An edit beats a delete. A lost record is
 * safe: every file looks new, so identical ones match and the rest keep both.
 * A local delete travels only when the session edit log explains it, or with
 * `deletes: "all"`; the rest are held. Remote deletes move files to the Trash.
 * A remote change mid-run is left for the next run and reported as a conflict.
 */
import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { edit_log, edit_log_path } from "./edits.js"
import { apply, load_calls, replayable } from "./replay.js"
import { homedir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { skipped, skipped_name } from "./skip.js"

/** The development sync service, unless SYNC_URL says otherwise. */
export const SYNC_URL = process.env.SYNC_URL ?? "https://brayness-sync-639469569733.us-central1.run.app"

/** Sync records live here, never inside the folders they describe. */
export const state_dir = (env = process.env) => env.BRAYNESS_STATE ?? join(homedir(), ".local/state/brayness")

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
    async sync(local, remote, { concurrency = 8, state = state_dir(), deletes = "explained", trash = trash_dir(state) } = {}) {
      const folder = remote.endsWith("/") ? remote : `${remote}/`
      const pair = { local: resolve(local), remote: key(folder) }
      const record_path = join(state, "sync", `${sha(`${pair.local}\n${pair.remote}`).slice(0, 16)}.json`)
      const manifest = JSON.parse(await readFile(record_path, "utf8").catch(() => "{}")).files ?? {}
      const report = { pushed: [], pulled: [], deleted: [], held: [], removed: [], adopted: [], replayed: [], kept_both: [], unchanged: [], conflicts: [], sessions: {} }

      const log = edit_log(edit_log_path(state))
      const locals = new Map()
      for (const file of await walk(local).catch(() => [])) locals.set(relative(local, file).split(sep).join("/"), file)
      const remotes = await api.walk(folder)
      // The never-sync list holds both ways: a remote `.env` is never pulled.
      const names = new Set([...locals.keys(), ...Object.keys(remotes), ...Object.keys(manifest)].filter((name) => !skipped(name)))

      const file_of = (name) => join(pair.local, ...name.split("/"))
      const agree = (name, bytes, version) => (manifest[name] = { sha: sha(bytes), version, at: new Date().toISOString() })
      const forget = (name) => delete manifest[name]
      const fetch_remote = async (name) => {
        const response = await expect(await call("GET", `${folder}${name}`), `get ${name}`, [200, 404])
        if (response.status === 404) return null
        return { bytes: Buffer.from(await response.arrayBuffer()), version: version_of(response) }
      }
      const pull = async (name, theirs) => {
        const target = join(local, name)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, theirs.bytes)
        agree(name, theirs.bytes, theirs.version)
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
              // Only a delete a session explains travels; the rest wait for --deletes.
              if (deletes !== "all" && !log.explained(file_of(name), null)) return report.held.push(name)
              await expect(await call("DELETE", `${folder}${name}`, { headers: conditional(base) }), `rm ${name}`, [204])
              forget(name)
              return report.deleted.push(name)
            }
            agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(base)))
            return report.pushed.push(name)
          }
          if (!local_moved && remote_moved) {
            if (!remote_version) {
              await to_trash(join(local, name), trash)
              forget(name)
              return report.removed.push(name)
            }
            const theirs = await fetch_remote(name)
            if (!theirs) return report.conflicts.push(name)
            await pull(name, theirs)
            return report.pulled.push(name)
          }
          // Both moved. The same bytes, or both gone, is agreement; an edit beats a delete.
          const theirs = remote_version ? await fetch_remote(name) : null
          if (!bytes && !theirs) return void forget(name)
          if (!bytes) {
            await pull(name, theirs)
            return report.pulled.push(name)
          }
          if (!theirs) {
            agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(null)))
            return report.pushed.push(name)
          }
          if (sha(theirs.bytes) === local_sha) {
            agree(name, bytes, theirs.version)
            return report.adopted.push(name)
          }
          // Ours is only session edits since we agreed: apply them to theirs.
          const rows = base?.at && replayable(log.since(file_of(name), base.at), local_sha)
          const replayed = rows && apply(theirs.bytes.toString("utf8"), await load_calls(rows))
          if (typeof replayed === "string") {
            const merged = Buffer.from(replayed)
            await writeFile(join(local, name), merged)
            agree(name, merged, await api.put(`${folder}${name}`, merged, conditional(theirs)))
            return report.replayed.push(name)
          }
          // Keep both: theirs lands beside ours under a new name, both travel.
          const ours = log.explained(file_of(name), local_sha) && log.last(file_of(name))
          if (ours) report.sessions[name] = { session: ours.session, turn: ours.turn }
          const copy = conflict_name(name, (taken) => locals.has(taken) || taken in remotes)
          locals.set(copy, join(local, copy))
          await writeFile(join(local, copy), theirs.bytes)
          agree(copy, theirs.bytes, await api.put(`${folder}${copy}`, theirs.bytes, conditional(null)))
          agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(theirs)))
          report.kept_both.push(name)
        } catch (error) {
          // The remote moved while we worked: a conflict for the next run.
          if (error.status !== 412) throw error
          report.conflicts.push(name)
        }
      }

      const all = [...names].sort()
      for (let i = 0; i < all.length; i += concurrency) await Promise.all(all.slice(i, i + concurrency).map(one))
      log.close()
      await mkdir(dirname(record_path), { recursive: true })
      await writeFile(record_path, `${JSON.stringify({ ...pair, files: manifest }, null, 2)}\n`)
      for (const list of Object.values(report)) if (Array.isArray(list)) list.sort()
      return report
    },
  }
  return api
}

/** macOS keeps a Trash; elsewhere removed files wait in harness state. */
export const trash_dir = (state, env = process.env) =>
  env.BRAYNESS_TRASH ?? (process.platform === "darwin" ? join(homedir(), ".Trash") : join(state, "trash"))

/** Move a file aside, never destroy it: `note.md` lands as `note 2026-09-27T….md`. */
async function to_trash(path, trash) {
  const stamp = new Date().toISOString().replace(/:/g, "-")
  const name = basename(path)
  const dot = name.lastIndexOf(".")
  const target = join(trash, dot > 0 ? `${name.slice(0, dot)} ${stamp}${name.slice(dot)}` : `${name} ${stamp}`)
  await mkdir(trash, { recursive: true })
  try {
    await rename(path, target)
  } catch (error) {
    if (error.code === "ENOENT") return
    if (error.code !== "EXDEV") throw error
    await copyFile(path, target)
    await rm(path, { force: true })
  }
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
