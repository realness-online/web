import { issue_record_pass } from '#root/src/sign-on/node/halo-pass.js'
import { HTTP } from '#root/lib/http.js'

const SYNC_TIMEOUT_MS = 10_000
/** A missing file is asked for again after this, doubling up to the cap. */
export const MISSING_FIRST_MS = 60_000
export const MISSING_CAP_MS = 240_000

const key_path = key => key.split('/').map(encodeURIComponent).join('/')

export class SyncMirror {
  /** @type {string} */
  url
  /** @type {string} */
  secret
  /** @type {string} */
  halo
  /** @type {() => number} */
  now
  /** Keys that answered 404: when to ask again, and the wait after that. */
  #missing = new Map()

  /**
   * @param {object} options
   * @param {string} options.url the sync service, without a trailing slash
   * @param {string} options.secret the halo record secret
   * @param {string} options.halo this halo's name
   * @param {() => number} [options.now]
   */
  constructor({ url, secret, halo, now = () => Date.now() }) {
    if (!url || !secret || !halo)
      throw new Error(
        'sync mirror needs a sync address, HALO_PASS_SECRET, and a halo name'
      )
    Object.assign(this, { url: url.replace(/\/$/, ''), secret, halo, now })
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
    this.#missing.delete(key)
  }

  /**
   * The stored file, or null when there is none. A key that was missing is
   * not asked for again until its wait is up: 1 minute, doubling to 4.
   */
  async get(key) {
    const missing = this.#missing.get(key)
    if (missing && this.now() < missing.until) return null
    const response = await this.#call('GET', key)
    if (response.status === HTTP.NOT_FOUND) {
      const wait = missing
        ? Math.min(missing.wait * 2, MISSING_CAP_MS)
        : MISSING_FIRST_MS
      this.#missing.set(key, { until: this.now() + wait, wait })
      return null
    }
    if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
    this.#missing.delete(key)
    return { body: Buffer.from(await response.arrayBuffer()) }
  }
}
