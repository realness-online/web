/**
 * The halo's API, as seen from outside the halo.
 *
 * Control may only reach the live side through this. Nothing here imports,
 * reads, or writes anything under server/halo/ - it starts the server and then talks to
 * it over HTTP. That boundary is what keeps the two worlds from mixing.
 *
 * On a halo the API is loopback-only until h1 exists, so a call is an ssh
 * command running curl. In dev it is Lima's port forward, so it is plain
 * fetch. Both are behind `call()`.
 */
import { attempt } from './exec.js'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- health polling waits between tries */

const CALL_TIMEOUT_S = 30

/**
 * Wait for /v1/health to answer, and for the seed to exist.
 *
 * Health answers `ok: true` as soon as the HTTP server is listening - before
 * the seed is built, which on a cold start means booting the template and
 * pausing it (about 36s). Waiting on `ok` alone reports a stack as up when it
 * has no seed and cannot make an actor.
 */
export const waitForHealth = async (
  api,
  { tries, delayMs, requireSeed = true }
) => {
  let last = 'no response'
  for (let i = 0; i < tries; i += 1) {
    const health = await attempt('curl', [
      '-sf',
      '--max-time',
      '3',
      `${api}/v1/health`
    ])
    if (health.ok && health.out.trim()) {
      const parsed = JSON.parse(health.out)
      if (!requireSeed || parsed.seed?.built) return parsed
      last = 'listening, seed not built yet'
    } else last = health.err.trim().split('\n').pop() || last

    await sleep(delayMs)
  }
  throw new Error(
    `no health after ${((tries * delayMs) / MS_PER_SECOND).toFixed(0)}s: ${last}`
  )
}

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * The API as reached over ssh, for a halo.
 *
 * Returns a `curl` invocation quoted for the remote shell. The API is only
 * bound to loopback there, so this is the only way in without a tunnel.
 */
export const remoteApi = (name, { zone }) => {
  const base = 'http://127.0.0.1:8080'

  /** Quote a string for a single shell word. */
  const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`

  const sshArgs = command => {
    const args = ['compute', 'ssh', name]
    if (zone) args.push(`--zone=${zone}`)
    args.push('--quiet', `--command=${command}`)
    return args
  }

  return {
    sshArgs,

    /**
     * curl the API on the halo and return stdout. Throws on a bad exit.
     * @param {string} path
     * @param {{ method?: string, body?: object | null, timeout?: number }} [options]
     * @returns {Promise<string>}
     */
    async call(
      path,
      { method = 'GET', body = null, timeout = CALL_TIMEOUT_S } = {}
    ) {
      const parts = ['curl', '-sS', '--max-time', String(timeout)]
      if (method !== 'GET') parts.push('-X', method)
      if (body !== null)
        parts.push(
          '-H',
          "'content-type: application/json'",
          '-d',
          quote(JSON.stringify(body))
        )
      parts.push(quote(`${base}${path}`))
      const result = await attempt('gcloud', sshArgs(parts.join(' ')))
      if (!result.ok)
        throw new Error(result.err.trim() || `ssh to ${name} failed`)
      return result.out
    },

    /** As `call`, parsed as JSON. */
    async json(path, options) {
      const text = await this.call(path, options)
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(
          `${path} did not answer JSON: ${text.slice(0, HTTP.OK)}`
        )
      }
    }
  }
}
