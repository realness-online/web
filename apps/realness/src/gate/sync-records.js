import { issue_gate_pass } from '#root/src/sign-on/node/gate-pass.js'
import { HTTP } from '#root/lib/http.js'

const SYNC_TIMEOUT_MS = 10_000

const key_path = key => key.split('/').map(encodeURIComponent).join('/')

/**
 * The gate's records, read and written through sync with a gate pass, so
 * sync's rules decide what the gate may touch.
 * @param {{ url: string, secret: string, halo: string, fetcher?: typeof fetch }} options
 */
export const sync_records = ({ url, secret, halo, fetcher = fetch }) => {
  if (!url || !secret || !halo)
    throw new Error(
      'gate records need a sync address, HALO_PASS_SECRET, and a halo'
    )
  const base = url.replace(/\/$/, '')
  const call = (method, key, body) =>
    fetcher(`${base}/${key_path(key)}`, {
      method,
      headers: { authorization: `Bearer ${issue_gate_pass(halo, secret)}` },
      ...(body !== undefined && { body }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS)
    })
  return {
    /** The stored file, or null when there is none. */
    async get(key) {
      const response = await call('GET', key)
      if (response.status === HTTP.NOT_FOUND) return null
      if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
      return { body: Buffer.from(await response.arrayBuffer()) }
    },
    async put(key, body) {
      const response = await call('PUT', key, body)
      if (!response.ok) throw new Error(`sync ${key}: ${response.status}`)
    }
  }
}
