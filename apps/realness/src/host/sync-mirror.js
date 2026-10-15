import { issue_record_pass } from '#root/src/sign-on/node/host-pass.js'
import { HTTP } from '#root/lib/http.js'

const SYNC_TIMEOUT_MS = 10_000

const key_path = key => key.split('/').map(encodeURIComponent).join('/')

export class SyncMirror {
  /** @type {string} */
  url
  /** @type {string} */
  secret
  /** @type {string} */
  host

  /**
   * @param {object} options
   * @param {string} options.url the sync service, without a trailing slash
   * @param {string} options.secret the host record secret
   * @param {string} options.host this host's name
   */
  constructor({ url, secret, host }) {
    if (!url || !secret || !host)
      throw new Error(
        'sync mirror needs SYNC_URL, HOST_PASS_SECRET, and a host name'
      )
    Object.assign(this, { url: url.replace(/\/$/, ''), secret, host })
  }

  #call(method, key, body) {
    return fetch(`${this.url}/${key_path(key)}`, {
      method,
      headers: {
        authorization: `Bearer ${issue_record_pass(this.host, this.secret)}`
      },
      ...(body !== undefined && { body }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS)
    })
  }

  async put(key, body) {
    const response = await this.#call('PUT', key, body)
    if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
  }

  /** The stored file, or null when there is none. */
  async get(key) {
    const response = await this.#call('GET', key)
    if (response.status === HTTP.NOT_FOUND) return null
    if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
    return { body: Buffer.from(await response.arrayBuffer()) }
  }
}
