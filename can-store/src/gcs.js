/**
 * Google Cloud Storage over its JSON API: plain fetch, no dependencies.
 *
 *   create_gcs({ bucket, token, prefix })
 *
 * `token()` resolves to an OAuth access token: `metadata_token()` on Cloud
 * Run, `gcloud_token()` on a laptop. `prefix` scopes every key, so tests can
 * run inside a throwaway folder. Versions are object generations, and
 * `ifGenerationMatch=0` is a true create-only write.
 */
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Conflict } from "./disk.js"

const API = "https://storage.googleapis.com/storage/v1/b"
const UPLOAD = "https://storage.googleapis.com/upload/storage/v1/b"

/** Cache a token until a minute before it expires. */
const cached = (fetch_token) => {
  let token = null
  let until = 0
  return async () => {
    if (token && Date.now() < until) return token
    const { access_token, expires_in } = await fetch_token()
    token = access_token
    until = Date.now() + (expires_in - 60) * 1000
    return token
  }
}

/** On Cloud Run or a Compute Engine VM: the attached service account. */
export const metadata_token = () =>
  cached(async () => {
    const url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
    const response = await fetch(url, { headers: { "Metadata-Flavor": "Google" } })
    if (!response.ok) throw new Error(`metadata token: ${response.status}`)
    return response.json()
  })

/** On a laptop: whoever `gcloud auth login` signed in. */
export const gcloud_token = () =>
  cached(async () => {
    const { stdout } = await promisify(execFile)("gcloud", ["auth", "print-access-token"])
    return { access_token: stdout.trim(), expires_in: 30 * 60 }
  })

export function create_gcs({ bucket, token, prefix = "" }) {
  if (!bucket) throw new Error("create_gcs needs a bucket")
  if (typeof token !== "function") throw new Error("create_gcs needs token()")
  if (prefix && !prefix.endsWith("/")) throw new Error("prefix must end in /")

  const object = (key) => encodeURIComponent(`${prefix}${key}`)
  const call = async (url, init = {}) =>
    fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${await token()}` } })
  const fail = async (what, response) => {
    throw new Error(`gcs ${what}: ${response.status} ${(await response.text()).slice(0, 200)}`)
  }
  const precondition = (if_version) =>
    if_version === undefined ? "" : `ifGenerationMatch=${if_version === null ? 0 : encodeURIComponent(if_version)}`

  return {
    async get(key) {
      const response = await call(`${API}/${bucket}/o/${object(key)}?alt=media`)
      if (response.status === 404) return null
      if (!response.ok) await fail(`get ${key}`, response)
      const body = Buffer.from(await response.arrayBuffer())
      return { body, version: response.headers.get("x-goog-generation") }
    },

    async put(key, body, { if_version } = {}) {
      const query = [`uploadType=media`, `name=${object(key)}`, precondition(if_version)].filter(Boolean)
      const response = await call(`${UPLOAD}/${bucket}/o?${query.join("&")}`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body,
      })
      if (response.status === 412) throw new Conflict(`${key} changed`)
      if (!response.ok) await fail(`put ${key}`, response)
      return String((await response.json()).generation)
    },

    async delete(key, { if_version } = {}) {
      const query = precondition(if_version)
      const response = await call(`${API}/${bucket}/o/${object(key)}${query ? `?${query}` : ""}`, {
        method: "DELETE",
      })
      if (response.status === 412) throw new Conflict(`${key} changed`)
      if (response.status === 404) {
        if (typeof if_version === "string") throw new Conflict(`${key} is gone`)
        return
      }
      if (!response.ok) await fail(`delete ${key}`, response)
    },

    async list(folder) {
      const scope = `${prefix}${folder.replace(/\/?$/, "/").replace(/^\/$/, "")}`
      const files = []
      const folders = []
      let page = ""
      do {
        const query = new URLSearchParams({ prefix: scope, delimiter: "/", fields: "items(name),prefixes,nextPageToken" })
        if (page) query.set("pageToken", page)
        const response = await call(`${API}/${bucket}/o?${query}`)
        if (!response.ok) await fail(`list ${folder}`, response)
        const found = await response.json()
        for (const item of found.items ?? []) files.push(item.name.slice(scope.length))
        for (const name of found.prefixes ?? []) folders.push(name.slice(scope.length, -1))
        page = found.nextPageToken ?? ""
      } while (page)
      return { files: files.filter(Boolean).sort(), folders: folders.sort() }
    },
  }
}
