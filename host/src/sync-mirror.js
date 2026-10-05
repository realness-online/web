// The host's records go through sync (o1): the host holds no storage key, so
// it signs a record pass with the host secret. Same put/get as a store, so
// Loops and HostStatus do not know where their records live.
import { createHmac as create_hmac } from "node:crypto"

const issue_record_pass = (host, secret) => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-records", host, exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url")
  return `${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}

const key_path = (key) => key.split("/").map(encodeURIComponent).join("/")

export class SyncMirror {
  constructor({ url, secret, host }) {
    if (!url || !secret || !host) throw new Error("sync mirror needs SYNC_URL, HOST_PASS_SECRET, and a host name")
    Object.assign(this, { url: url.replace(/\/$/, ""), secret, host })
  }

  #call(method, key, body) {
    return fetch(`${this.url}/${key_path(key)}`, {
      method,
      headers: { authorization: `Bearer ${issue_record_pass(this.host, this.secret)}` },
      ...(body !== undefined && { body }),
      signal: AbortSignal.timeout(10_000),
    })
  }

  async put(key, body) {
    const response = await this.#call("PUT", key, body)
    if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
  }

  /** The stored file, or null when there is none. */
  async get(key) {
    const response = await this.#call("GET", key)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
    return { body: Buffer.from(await response.arrayBuffer()) }
  }
}
