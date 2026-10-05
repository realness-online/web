// The host uploads a built tree to sync. Activation happens only after every
// file arrives; readers keep seeing the previous version if upload fails.
import { randomBytes as random_bytes } from "node:crypto"
import { readFile as read_file, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { issue_host_pass } from "./host-pass.js"
import { skipped } from "../../sync/src/skip.js"

const ID = /^a-[a-f0-9]{12}$/
const VERSION = /^[a-f0-9]{12}$/

export class SyncSites {
  constructor({ url, secret }) {
    if (!url || !secret) throw new Error("sync sites need SYNC_URL and HOST_PASS_SECRET")
    this.url = url.replace(/\/$/, "")
    this.secret = secret
  }

  async request(owner, method, path, body) {
    const response = await fetch(`${this.url}/v1/sites/${path}`, {
      method,
      headers: { authorization: `Bearer ${issue_host_pass({ phone: owner }, this.secret)}` },
      ...(body !== undefined && { body }),
    })
    if (!response.ok) throw new Error(`sync site ${method} ${path}: ${response.status} ${(await response.text()).slice(0, 150)}`)
    return response.headers.get("content-type")?.includes("application/json") ? response.json() : null
  }

  async save_source(owner, site, root) {
    const saved = new Set([".brayness-site-id"])
    const prefix = `people/${encodeURIComponent(owner)}/work/site/`
    const headers = { authorization: `Bearer ${issue_host_pass({ phone: owner }, this.secret)}` }
    const upload = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name)
        const name = relative(root, file).split(sep).join("/")
        if (skipped(name)) continue
        if (entry.isDirectory()) await upload(file)
        else if (entry.isFile()) {
          saved.add(name)
          const path = `${prefix}${name.split("/").map(encodeURIComponent).join("/")}`
          const response = await fetch(`${this.url}/${path}`, { method: "PUT", headers, body: await read_file(file) })
          if (!response.ok) throw new Error(`sync site source ${name}: ${response.status}`)
        }
      }
    }
    await upload(root)
    const listing = await fetch(`${this.url}/${prefix}?deep`, { headers })
    if (!listing.ok) throw new Error(`sync site source list: ${listing.status}`)
    for (const name of Object.keys(await listing.json())) {
      if (saved.has(name) || skipped(name)) continue
      const response = await fetch(`${this.url}/${prefix}${name.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers })
      if (!response.ok) throw new Error(`sync site source delete ${name}: ${response.status}`)
    }
    const marker = await fetch(`${this.url}/${prefix}.brayness-site-id`, { method: "PUT", headers, body: `${site}\n` })
    if (!marker.ok) throw new Error(`sync site ID: ${marker.status}`)
  }

  async publish(owner, site, root, source = root) {
    if (!ID.test(site)) throw new Error("invalid site ID")
    const version = random_bytes(6).toString("hex")
    let count = 0
    let bytes = 0
    const upload = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name === ".brayness-site-id") continue
        const file = join(directory, entry.name)
        if (entry.isDirectory()) await upload(file)
        else if (entry.isFile()) {
          const name = relative(root, file).split(sep).map(encodeURIComponent).join("/")
          const contents = await read_file(file)
          await this.request(owner, "PUT", `${site}/versions/${version}/files/${name}`, contents)
          count++
          bytes += contents.length
        }
      }
    }
    await upload(root)
    await this.save_source(owner, site, source)
    const result = await this.request(owner, "POST", `${site}/activate`, version)
    return { ...result, files: count, bytes }
  }

  versions(owner, site) {
    if (!ID.test(site)) throw new Error("invalid site ID")
    return this.request(owner, "GET", `${site}/versions`)
  }

  restore(owner, site, version) {
    if (!ID.test(site) || !VERSION.test(version)) throw new Error("invalid site version")
    return this.request(owner, "POST", `${site}/activate`, version)
  }

  remove(owner, site) {
    if (!ID.test(site)) throw new Error("invalid site ID")
    return this.request(owner, "DELETE", `${site}/active`)
  }
}
