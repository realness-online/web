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
import { createHash as create_hash } from "node:crypto"
import { chmod, copyFile as copy_file, lstat, mkdir, readFile as read_file, readdir, rename, rm, stat, writeFile as write_file } from "node:fs/promises"
import { edit_log, edit_log_path } from "./edits.js"
import { apply, load_calls, replayable } from "./replay.js"
import { homedir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { skipped, skipped_name } from "./skip.js"
import { starter_base, starter_bytes, starter_choice } from "./starter.js"

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

const sha = (bytes) => create_hash("sha256").update(bytes).digest("hex")

/** The phone number a token names, read locally only to build paths. */
export const phone_of = (token) => {
  if (!token) return null
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url")).phone_number ?? null
  } catch {
    return null
  }
}

/** The sync service's upload limit (server.js LIMIT). */
export const MAX_BYTES = 10 * 1024 * 1024

export const is_remote = (path) => path.startsWith("can://")

export const client = ({ url, token, fetcher = fetch, phone = phone_of(token) }) => {
  const me = phone

  const key = (path) => {
    let rest = path.replace(/^can:\/\//, "")
    if (rest === "~" || rest.startsWith("~/")) {
      if (!me) throw new Error("can://~ needs a token with a phone number")
      rest = `people/${me}${rest.slice(1)}`
    }
    return rest
  }

  const call = async (method, path, { body, headers = {}, query = "" } = {}) => {
    const current_token = typeof token === "function" ? await token() : token
    const auth = current_token ? { authorization: `Bearer ${current_token}` } : {}
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
        await api.put(target, await read_file(from))
        return target
      }
      let target = to
      if (to.endsWith(sep) || to.endsWith("/") || (await is_dir(to))) target = join(to, basename(key(from)))
      await mkdir(dirname(target), { recursive: true })
      await write_file(target, await api.cat(from))
      return target
    },

    /** Every remote file below a folder, name to version. */
    async walk(path) {
      const folder = path.endsWith("/") ? path : `${path}/`
      return (await expect(await call("GET", folder, { query: "deep" }), `walk ${path}`)).json()
    },

    /**
     * h3: what moved under a folder since `cursor`, as `{ cursor, changes }`;
     * an empty cursor starts one. Null when the service has no feed or the
     * cursor expired, so the caller walks instead.
     */
    async changes(path, cursor = "") {
      const folder = path.endsWith("/") ? path : `${path}/`
      const response = await call("GET", folder, { query: `changes=${encodeURIComponent(cursor)}` })
      if (response.status === 410) return null
      const feed = await (await expect(response, `changes ${path}`)).json()
      return typeof feed?.cursor === "string" && feed.changes ? feed : null
    },

    /** Two-way: whichever side moved from the base wins; both moving is a conflict. */
    async sync(local, remote, { concurrency = 32, state = state_dir(), deletes = "explained", trash = trash_dir(state), defer_edits = false, sessions, sessions_remote = "can://~/.pi/agent/sessions/", only = null, exclude = () => false, max_bytes = MAX_BYTES, pull_only = false, baseline = false, remote_files = null, starter = null } = {}) {
      const folder = remote.endsWith("/") ? remote : `${remote}/`
      const pair = { local: resolve(local), remote: key(folder) }
      // `only` syncs named files in a folder; each selection keeps its own record.
      const selected = only && new Set(only)
      const record_key = `${pair.local}\n${pair.remote}${selected ? `\n${[...selected].sort().join("\n")}` : ""}`
      const record_path = join(state, "sync", `${sha(record_key).slice(0, 16)}.json`)
      const saved = pull_only ? {} : JSON.parse(await read_file(record_path, "utf8").catch(() => "{}"))
      const manifest = saved.files ?? {}
      const deferred = saved.deferred ?? {}
      const report = { too_big: [], pushed: [], pulled: [], deferred: [], deleted: [], held: [], removed: [], adopted: [], replayed: [], kept_both: [], unchanged: [], conflicts: [], sessions: {}, replay: {} }

      const log = edit_log(edit_log_path(state))
      const session_folder = sessions && resolve(sessions)
      const locals = new Map()
      for (const file of await walk(local, (path, is_dir) => exclude(relative(local, path).split(sep).join("/"), is_dir)).catch(() => [])) locals.set(relative(local, file).split(sep).join("/"), file)
      // h3: replay the change feed onto the last listing; walk when it cannot vouch.
      const feed = remote_files || pull_only ? null : await api.changes(folder, saved.cursor ?? "").catch(() => null)
      const fresh_walk = !saved.walked_at || Date.now() - Date.parse(saved.walked_at) > WALK_EVERY_MS
      let remotes = remote_files
      let walked_at = saved.walked_at
      if (!remotes && feed && saved.cursor && saved.remotes && !fresh_walk) {
        remotes = { ...saved.remotes }
        for (const [name, version] of Object.entries(feed.changes)) {
          if (version === null) delete remotes[name]
          else remotes[name] = version
        }
      }
      if (!remotes) {
        remotes = await api.walk(folder)
        walked_at = new Date().toISOString()
      }
      report.listing = remote_files ? "given" : walked_at === saved.walked_at ? "feed" : "walk"
      const stock = await starter_base(api, folder, starter)
      const managed = new Set([
        ...Object.entries(stock?.latest.files ?? {}),
        ...Object.entries(stock?.previous?.files ?? {}),
      ].filter(([, value]) => !value.startsWith("link:")).map(([name]) => name))
      // The never-sync list holds both ways: a remote `.env` is never pulled.
      const names = new Set([...locals.keys(), ...Object.keys(remotes), ...Object.keys(manifest), ...managed].filter((name) => !skipped(name) && !exclude(name, false) && (!selected || selected.has(name))))

      const file_of = (name) => join(pair.local, ...name.split("/"))
      const read_replay = (name, base, bytes) => {
        if (!session_folder || !base?.at || !bytes || !base.version) return null
        const rows = replayable(log.since(file_of(name), base.at), sha(bytes))
        if (!rows?.length || rows.some((row) => !row.session.startsWith(session_folder + sep) || !row.session.endsWith(".jsonl"))) return null
        return rows
      }
      const agree = (name, bytes, version) => {
        delete deferred[name]
        manifest[name] = { sha: sha(bytes), version, at: new Date().toISOString() }
      }
      const forget = (name) => {
        delete deferred[name]
        delete manifest[name]
      }
      const can_defer = async (name, base, bytes, existing = false) => {
        if (!defer_edits || (deferred[name] && !existing)) return false
        const rows = read_replay(name, base, bytes)
        if (!rows) return false
        const calls = await load_calls(rows)
        const original = await fetch_remote(name)
        if (!original || original.version !== base.version || sha(original.bytes) !== base.sha) return false
        for (const session of new Set(rows.map((row) => row.session))) {
          const session_name = relative(session_folder, session).split(sep).join("/")
          const saved_session = await expect(await call("GET", `${sessions_remote}${session_name}`), `saved session ${session_name}`, [200, 404])
          if (saved_session.status === 404 || sha(Buffer.from(await saved_session.arrayBuffer())) !== sha(await read_file(session))) return false
        }
        const replayed = apply(original.bytes.toString("utf8"), calls)
        if (replayed === null || !Buffer.from(replayed).equals(bytes)) return false
        report.replay[name] = {
          base_sha: base.sha,
          target_sha: sha(bytes),
          calls: rows.map((row) => ({ session: relative(session_folder, row.session).split(sep).join("/"), tool_call: row.tool_call })),
        }
        return true
      }
      const fetch_remote = async (name) => {
        const response = await expect(await call("GET", `${folder}${name}`), `get ${name}`, [200, 404])
        if (response.status === 404) return null
        return { bytes: Buffer.from(await response.arrayBuffer()), version: version_of(response) }
      }
      const pull = async (name, theirs) => {
        await safe_target(local, name)
        const target = join(local, name)
        await mkdir(dirname(target), { recursive: true })
        await write_file(target, theirs.bytes)
        agree(name, theirs.bytes, theirs.version)
      }
      const conditional = (base) => (base ? { "if-match": `"${base.version}"` } : { "if-none-match": "*" })

      const one = async (name) => {
        if (stock && name === "starter.json") return
        const base = manifest[name]
        const file = locals.get(name)
        const bytes = file ? await read_file(file) : null
        // The service refuses big uploads; leave them home and say so.
        if (bytes && bytes.length > max_bytes) return report.too_big.push(name)
        const local_sha = bytes ? sha(bytes) : null
        const remote_version = remotes[name] ?? null
        const local_moved = local_sha !== (base?.sha ?? null)
        const remote_moved = remote_version !== (base?.version ?? null)

        try {
          const updating_starter = stock && managed.has(name) && !stock.pending.has(name) && (pull_only || stock.previous?.version !== stock.latest.version)
          if (updating_starter) {
            const theirs = remote_version ? await fetch_remote(name) : null
            const choice = starter_choice(stock, name, bytes, theirs?.bytes ?? null)
            if (choice === "keep-local" && !pull_only && (deletes === "all" || log.explained(file_of(name), null))) {
              if (theirs) await expect(await call("DELETE", `${folder}${name}`, { headers: conditional(theirs) }), `rm ${name}`, [204])
              forget(name)
              return report.deleted.push(name)
            }
            if (choice === "keep-local" || (choice === "personal" && pull_only)) return report.held.push(name)
            if (choice === "remote") {
              await pull(name, theirs)
              return report.pulled.push(name)
            }
            if (choice === "remove" || choice === "remove-local") {
              if (choice === "remove" && theirs && !pull_only) {
                await expect(await call("DELETE", `${folder}${name}`, { headers: conditional(theirs) }), `rm ${name}`, [204])
                report.deleted.push(name)
              }
              if (bytes) {
                await safe_target(local, name)
                await to_trash(join(local, name), trash)
                report.removed.push(name)
              }
              forget(name)
              return
            }
            if (choice === "latest") {
              const updated = await starter_bytes(stock, name)
              if (updated.length > max_bytes) return report.too_big.push(name)
              await safe_target(local, name)
              await mkdir(dirname(join(local, name)), { recursive: true })
              if (!bytes?.equals(updated)) await write_file(join(local, name), updated)
              if (!bytes) await chmod(join(local, name), (await stat(join(stock.directory, name))).mode & 0o777)
              if (pull_only) {
                // A baseline must know stock files too, or deleting one before the first sync pulls it back.
                if (theirs?.bytes.equals(updated)) agree(name, updated, theirs.version)
                return report.pulled.push(name)
              }
              if (theirs?.bytes.equals(updated)) {
                agree(name, updated, theirs.version)
                return report.adopted.push(name)
              }
              agree(name, updated, await api.put(`${folder}${name}`, updated, conditional(theirs)))
              return report.pushed.push(name)
            }
          }
          // Recovery uses the same file transport, without writes or deletes.
          if (pull_only) {
            await safe_target(local, name)
            if (!remote_version) return report.unchanged.push(name)
            const theirs = await fetch_remote(name)
            if (!theirs) return report.conflicts.push(name)
            if (bytes && sha(theirs.bytes) === local_sha) {
              agree(name, bytes, theirs.version)
              return report.adopted.push(name)
            }
            await pull(name, theirs)
            return report.pulled.push(name)
          }
          if (!local_moved && !remote_moved) {
            if (deferred[name] && bytes) {
              if (local_sha === deferred[name] && await can_defer(name, base, bytes, true)) return report.deferred.push(name)
              agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(base)))
              return report.pushed.push(name)
            }
            return report.unchanged.push(name)
          }
          if (local_moved && !remote_moved) {
            if (deferred[name] && bytes && local_sha === deferred[name] && await can_defer(name, base, bytes, true)) return report.deferred.push(name)
            if (!bytes) {
              // Only a delete a session explains travels; the rest wait for --deletes.
              if (deletes !== "all" && !log.explained(file_of(name), null)) return report.held.push(name)
              await expect(await call("DELETE", `${folder}${name}`, { headers: conditional(base) }), `rm ${name}`, [204])
              forget(name)
              return report.deleted.push(name)
            }
            if (await can_defer(name, base, bytes)) {
              deferred[name] = local_sha
              return report.deferred.push(name)
            }
            agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(base)))
            return report.pushed.push(name)
          }
          if (!local_moved && remote_moved) {
            if (deferred[name] && local_sha !== base?.sha) {
              if (!bytes) return report.held.push(name)
              if (!remote_version) {
                agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(null)))
                return report.pushed.push(name)
              }
              const theirs = await fetch_remote(name)
              if (!theirs) return report.conflicts.push(name)
              if (sha(theirs.bytes) === local_sha) {
                agree(name, bytes, theirs.version)
                return report.adopted.push(name)
              }
              const copy = conflict_name(name, (taken) => locals.has(taken) || taken in remotes)
              await write_file(join(local, copy), theirs.bytes)
              agree(copy, theirs.bytes, await api.put(`${folder}${copy}`, theirs.bytes, conditional(null)))
              agree(name, bytes, await api.put(`${folder}${name}`, bytes, conditional(theirs)))
              return report.kept_both.push(name)
            }
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
            await write_file(join(local, name), merged)
            agree(name, merged, await api.put(`${folder}${name}`, merged, conditional(theirs)))
            return report.replayed.push(name)
          }
          // Keep both: theirs lands beside ours under a new name, both travel.
          const ours = log.explained(file_of(name), local_sha) && log.last(file_of(name))
          if (ours) report.sessions[name] = { session: ours.session, turn: ours.turn }
          const copy = conflict_name(name, (taken) => locals.has(taken) || taken in remotes)
          locals.set(copy, join(local, copy))
          await write_file(join(local, copy), theirs.bytes)
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
      // A pool, not batches: a slow file never holds up the rest.
      let next = 0
      const worker = async () => { while (next < all.length) await one(all[next++]) }
      await Promise.all(Array.from({ length: Math.min(concurrency, all.length) }, worker))
      log.close()
      // Advance the base only after every file settled. A raced or held update
      // retries against the old starter instead of losing its comparison base.
      if (stock && !report.conflicts.length && !report.held.length && !report.too_big.length) {
        const current = stock.outdated || stock.previous?.version === stock.latest.version ? stock.previous : stock.latest
        const bytes = Buffer.from(`${JSON.stringify(current, null, 2)}\n`)
        await safe_target(local, "starter.json")
        let version = remotes["starter.json"]
        if (!pull_only && !stock.previous_bytes?.equals(bytes)) {
          try { version = await api.put(`${folder}starter.json`, bytes, conditional(version ? { version } : null)) } catch (error) {
            if (error.status !== 412) throw error
            report.conflicts.push("starter.json")
          }
        }
        if (!report.conflicts.length) {
          await mkdir(local, { recursive: true })
          await write_file(join(local, "starter.json"), bytes)
          if (!pull_only) agree("starter.json", bytes, version)
        }
      }
      // A pull-only `baseline` saves what it pulled, so the next real sync knows those files.
      if (!pull_only || baseline) {
        await mkdir(dirname(record_path), { recursive: true })
        // The listing as it stood before this run's writes; the feed brings those back next time.
        const feed_state = feed && !pull_only ? { cursor: feed.cursor, walked_at, remotes } : {}
        await write_file(record_path, `${JSON.stringify({ ...pair, files: manifest, deferred, ...feed_state }, null, 2)}\n`)
      }
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
const to_trash = async (path, trash) => {
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
    await copy_file(path, target)
    await rm(path, { force: true })
  }
}

/** `note.md` becomes `note.conflict.md`, then `note.conflict-2.md`, until one is free. */
export const conflict_name = (name, taken) => {
  const slash = name.lastIndexOf("/") + 1
  const dot = name.indexOf(".", slash + 1)
  const [stem, ext] = dot === -1 ? [name, ""] : [name.slice(0, dot), name.slice(dot)]
  for (let n = 1; ; n++) {
    const candidate = `${stem}.conflict${n === 1 ? "" : `-${n}`}${ext}`
    if (!taken(candidate)) return candidate
  }
}

/** Refuse traversal and links before a remote file can replace local bytes. */
const safe_target = async (root, name) => {
  const parts = name.split("/")
  if (parts.some(part => !part || part === "." || part === ".." || /[\\\0]/.test(part))) throw new Error(`unsafe sync path: ${name}`)
  let target = resolve(root)
  for (const part of ["", ...parts]) {
    if (part) target = join(target, part)
    const info = await lstat(target).catch(error => {
      if (error.code === "ENOENT") return null
      throw error
    })
    if (info?.isSymbolicLink()) throw new Error(`target is a link: ${target}`)
  }
}

/** Even with a feed, list everything once a day: a lost record cannot linger. */
const WALK_EVERY_MS = 24 * 60 * 60 * 1000

const version_of = (response) => response.headers.get("etag")?.replace(/"/g, "")

const is_dir = async (path) => {
  return (await stat(path).catch(() => null))?.isDirectory() ?? false
}

const walk = async (dir, exclude = () => false) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skipped_name(entry.name)) continue
    const path = join(dir, entry.name)
    if (exclude(path, entry.isDirectory())) continue
    if (entry.isDirectory()) found.push(...(await walk(path, exclude)))
    else if (entry.isFile()) found.push(path)
  }
  return found.sort()
}
