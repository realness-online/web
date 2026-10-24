import { issue_record_pass } from '#root/src/sign-on/node/halo-pass.js'
import { HTTP } from '#root/lib/http.js'

const SYNC_TIMEOUT_MS = 10_000

const key_path = key => key.split('/').map(encodeURIComponent).join('/')

export class SyncMirror {
  /** @type {string} */
  url
  /** @type {string} */
  secret
  /** @type {string} */
  halo

  /**
   * @param {object} options
   * @param {string} options.url the sync service, without a trailing slash
   * @param {string} options.secret the halo record secret
   * @param {string} options.halo this halo's name
   */
  constructor({ url, secret, halo }) {
    if (!url || !secret || !halo)
      throw new Error(
        'sync mirror needs a sync address, HALO_PASS_SECRET, and a halo name'
      )
    Object.assign(this, { url: url.replace(/\/$/, ''), secret, halo })
  }

  #call(method, key, body) {
    return fetch(`${this.url}/${key_path(key)}`, {
      method,
      headers: {
        authorization: `Bearer ${issue_record_pass(this.halo, this.secret)}`
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
