/**
 * A gsutil-like client for the sync service. Every call carries the phone
 * token and passes `can()`; nothing here touches storage directly.
 *
 *   can://people/+1…/vault/note.md   a remote path
 *   can://~/vault/note.md            the same, for whoever the token names
 *
 * `rsync` is one-way, local to remote. It remembers what it uploaded in
 * `.can-sync.json` beside the files, skips what has not changed, and never
 * overwrites a remote file that changed since: that is a conflict to report.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join, relative, sep } from "node:path"
import { skipped_name } from "./skip.js"

const MANIFEST = ".can-sync.json"

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

  const call = async (method, path, { body, headers = {} } = {}) => {
    const auth = token ? { authorization: `Bearer ${token}` } : {}
    return fetcher(`${url}/${key(path)}`, { method, body, headers: { ...auth, ...headers } })
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

    /** One-way: every local file up, unchanged ones skipped, conflicts reported. */
    async rsync(local, remote, { concurrency = 8 } = {}) {
      const base = remote.endsWith("/") ? remote : `${remote}/`
      const manifest_path = join(local, MANIFEST)
      const manifest = JSON.parse(await readFile(manifest_path, "utf8").catch(() => "{}"))
      const report = { uploaded: [], unchanged: [], conflicts: [], adopted: [] }

      const one = async (file) => {
        const name = relative(local, file).split(sep).join("/")
        const bytes = await readFile(file)
        const hash = sha(bytes)
        const known = manifest[name]
        if (known?.sha === hash) return report.unchanged.push(name)
        const headers = known ? { "if-match": `"${known.version}"` } : { "if-none-match": "*" }
        try {
          manifest[name] = { sha: hash, version: await api.put(`${base}${name}`, bytes, headers) }
          report.uploaded.push(name)
        } catch (error) {
          if (error.status !== 412) throw error
          // Never synced from here, but the same bytes are already there: adopt them.
          const remote_file = await call("GET", `${base}${name}`)
          const remote_bytes = Buffer.from(await remote_file.arrayBuffer())
          if (!known && remote_file.ok && sha(remote_bytes) === hash) {
            manifest[name] = { sha: hash, version: remote_file.headers.get("etag").replace(/"/g, "") }
            report.adopted.push(name)
          } else report.conflicts.push(name)
        }
      }

      const files = await walk(local)
      for (let i = 0; i < files.length; i += concurrency) await Promise.all(files.slice(i, i + concurrency).map(one))
      await writeFile(manifest_path, `${JSON.stringify(manifest, null, 2)}\n`)
      return report
    },
  }
  return api
}

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
