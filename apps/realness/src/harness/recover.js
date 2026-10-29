/** Read-only recovery through the normal sync client; no storage credential. */
import { execFile as exec_file } from 'node:child_process'
import { connect as net_connect } from 'node:net'
import { existsSync as exists_sync } from 'node:fs'
import {
  mkdir,
  readFile as read_file,
  stat,
  utimes,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, basename, join, relative } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { client } from '#root/src/files/client.js'
import {
  apply_deferred,
  is_past_session,
  outermost,
  sync_exclusions_of,
  syncs_of,
  within
} from './harness.js'
import { plans_path, state_path, runtime_sessions_path } from './settings.js'
import { prepare_actor_state } from './state.js'
import { limit_path } from '#root/src/files/paths.js'
import { STARTER_DIRECTORY, STARTER_FILE } from '#root/src/files/starter.js'
import { light_policy, light_skips, write_skipped } from './light.js'
import { HTTP } from '#root/lib/http.js'
/* eslint-disable no-await-in-loop -- paths pull one at a time to bound memory on a small VM */

/** How long a halo door gets to answer before recovery gives up. */
const DOOR_TIMEOUT_MS = 10_000

/**
 * Node has no AF_VSOCK socket API; socat supplies only the socket transport.
 * REALNESS_DOOR_SOCK points the door at its unix socket (the box's directory
 * is mounted at /box), reached with node's own net. REALNESS_RECOVERY_PASS
 * skips the door: the halo signed the pass when it launched this recovery.
 */
export const door_pass = (op = 'recovery-pass') => {
  if (process.env.REALNESS_RECOVERY_PASS && op === 'recovery-pass')
    return Promise.resolve(process.env.REALNESS_RECOVERY_PASS)
  const request = () =>
    process.env.REALNESS_DOOR_SOCK
      ? ask_unix_door(process.env.REALNESS_DOOR_SOCK, op)
      : ask_vsock_door(op)
  return request().catch(error => Promise.reject(error))
}

const ask_vsock_door = op =>
  new Promise((resolve, reject) => {
    const child = exec_file(
      'socat',
      ['-t', '10', '-', 'VSOCK-CONNECT:2:54'],
      { timeout: 10000 },
      (error, stdout) => {
        if (error) return reject(error)
        const answer = JSON.parse(stdout.split('\n')[0])
        if (!answer.ok)
          return reject(
            new Error(answer.error || 'halo door did not issue a pass')
          )
        resolve(answer.pass)
      }
    )
    if (child.stdin) child.stdin.end(`${JSON.stringify({ op })}\n`)
    else reject(new Error('socat has no stdin'))
  })

const ask_unix_door = (path, op) =>
  new Promise((resolve, reject) => {
    const socket = net_connect(path)
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('halo door timed out'))
    }, DOOR_TIMEOUT_MS)
    socket.on('connect', () => socket.write(`${JSON.stringify({ op })}\n`))
    socket.on('data', chunk => {
      clearTimeout(timer)
      socket.destroy()
      try {
        const answer = JSON.parse(chunk.toString().split('\n')[0])
        if (!answer.ok)
          return reject(
            new Error(answer.error || 'halo door did not issue a pass')
          )
        resolve(answer.pass)
      } catch (error) {
        reject(error)
      }
    })
    socket.on('error', error => {
      clearTimeout(timer)
      reject(error)
    })
  })

/**
 * A door pass that renews itself: a 401 issues a fresh pass and asks once more.
 * @param {() => Promise<string>} issue
 * @param {typeof fetch} fetcher
 * @returns {Promise<{ token: () => string, fetcher: typeof fetch }>}
 */
const renewing_pass = async (issue, fetcher) => {
  let pass = await issue()
  return {
    token: () => pass,
    fetcher: async (url, options = {}) => {
      const response = await fetcher(url, options)
      if (response.status !== HTTP.UNAUTHORIZED) return response
      pass = await issue()
      return fetcher(url, {
        ...options,
        headers: { ...options.headers, authorization: `Bearer ${pass}` }
      })
    }
  }
}

/**
 * Session files keep the times sync recorded, so the newest session is still
 * the newest after a recovery writes them all at once.
 * @param {{ walk_meta: (path: string) => Promise<Record<string, { updated: string }>> }} store
 * @param {string} saved where the harness lives in the store
 * @param {string} root
 */
const restore_session_times = async (store, saved, root) => {
  const folder = runtime_sessions_path(root)
  const times = await store.walk_meta(`${saved}${folder}/`).catch(() => ({}))
  for (const [name, { updated }] of Object.entries(times)) {
    const at = new Date(updated)
    if (Number.isNaN(at.getTime())) continue
    await utimes(join(root, folder, name), at, at).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
  }
}

/**
 * Pull the harness back onto a light VM. Returns `[count, applied]`, with a
 * `light` property when the run used the path-limited light mode.
 * @param {string} url sync's base URL
 * @param {() => Promise<string>} issue a fresh door pass
 * @param {string} [root]
 * @param {{ state?: string, fetcher?: typeof fetch, starter?: string | null, keep_local?: string[] }} [options] keep_local: paths this box keeps from its own disk, not sync
 * @returns {Promise<[number, string[]] & { light: { skipped: number } | null }>}
 */
export const recover = async (
  url,
  issue,
  root = '/realness',
  {
    state: state_option = join(root, state_path(root)),
    fetcher = fetch,
    starter = exists_sync(join(STARTER_DIRECTORY, STARTER_FILE))
      ? STARTER_DIRECTORY
      : null,
    keep_local = []
  } = {}
) => {
  const state = await prepare_actor_state(root, { state: state_option })
  const pass = await renewing_pass(issue, fetcher)
  const claims = JSON.parse(
    Buffer.from(pass.token().split('.')[0], 'base64url').toString()
  )
  const base = `can://people/${claims.phone}/`
  const store = client({ url, token: pass.token, fetcher: pass.fetcher })
  const exclude = path => !limit_path(path)
  let count = 0
  /**
   * Paths this machine already holds as the main copy (the host vault): recovery
   * never writes there, whatever the store has.
   */
  const pull = async (remote, local, options = {}) => {
    const prefix = relative(root, local)
    if (prefix && within(keep_local, prefix)) return
    const inner = options.exclude ?? exclude
    const report = await store.sync(local, remote, {
      state,
      pull_only: true,
      ...options,
      exclude: (path, is_dir) =>
        within(keep_local, prefix ? `${prefix}/${path}` : path) ||
        inner(path, is_dir)
    })
    count += report.pulled.length + report.adopted.length
  }
  const optional = async path => {
    try {
      return await store.cat(path)
    } catch (error) {
      if (error.status === HTTP.FORBIDDEN || error.status === HTTP.NOT_FOUND)
        return null
      throw error
    }
  }
  /** Plan `!path` exclusions: never pulled, even when the store still holds them. */
  const excluded = new Set()
  const pull_path = async (path, base_url = base) => {
    const base = base_url
    if (!limit_path(path)) throw new Error(`unsafe path limit: ${path}`)
    let names
    try {
      names = await store.walk(`${base}${path}/`)
    } catch (error) {
      if (error.status !== HTTP.NOT_FOUND) throw error
    }
    if (names && Object.keys(names).length) {
      const kept = Object.fromEntries(
        Object.entries(names).filter(
          ([name]) => !within(excluded, `${path}/${name}`)
        )
      )
      return pull(`${base}${path}/`, join(root, path), {
        remote_files: kept,
        baseline: true,
        exclude: name => within(excluded, `${path}/${name}`)
      })
    }
    let version
    try {
      version = await store.version(`${base}${path}`)
    } catch (error) {
      if (error.status === HTTP.FORBIDDEN) return
      throw error
    }
    if (!version) return
    await pull(
      `${base}${dirname(path) === '.' ? '' : `${dirname(path)}/`}`,
      join(root, dirname(path)),
      {
        only: [basename(path)],
        remote_files: { [basename(path)]: version },
        baseline: true
      }
    )
  }
  let saved = base
  /** @type {{ skipped: number } | null} */
  let light = null
  if (claims.paths !== undefined) {
    const whole = (await optional(`${base}harness/.ignore`)) !== null
    if (whole) saved = `${base}harness/`
    for (const path of claims.paths)
      await pull_path(path, whole ? `${base}harness/` : base)
  } else if ((await optional(`${base}harness/.ignore`)) !== null) {
    saved = `${base}harness/`
    const before_package = count
    await pull_path('package.json', saved)
    count = before_package
    const policy = light_policy(
      await read_file(join(root, 'package.json'), 'utf8').catch(error => {
        if (error.code === 'ENOENT') return null
        throw error
      })
    )
    let skips = []
    if (policy) {
      const listing = await store.walk_meta(saved)
      skips = light_skips(
        listing,
        policy,
        Date.now(),
        runtime_sessions_path(root)
      )
      const keep = new Set(skips)
      await write_skipped(state, skips)
      const remote_files = Object.fromEntries(
        Object.entries(listing)
          .filter(([name]) => !keep.has(name))
          .map(([name, { version }]) => [name, version])
      )
      await pull(saved, root, {
        starter,
        baseline: true,
        remote_files,
        exclude: path =>
          !limit_path(path) || keep.has(path) || is_past_session(path)
      })
    } else {
      await write_skipped(state, [])
      await pull(saved, root, {
        starter,
        baseline: true,
        exclude: path => !limit_path(path) || is_past_session(path)
      })
    }
    light = { skipped: skips.length }
  } else {
    await pull_path('package.json')
    const sessions = runtime_sessions_path(root)
    await pull(`${base}${sessions}/`, join(root, sessions))
    const folder = plans_path(root)
    await pull(`${base}${folder}/`, join(root, folder))
    const names = await store.walk(`${base}${folder}/`)
    const paths = new Set()
    for (const name of Object.keys(names).filter(
      name => name.endsWith('.md') && !name.includes('/')
    )) {
      const text = await read_file(join(root, folder, name), 'utf8').catch(
        error => {
          if (error.code === 'ENOENT') return ''
          throw error
        }
      )
      for (const path of syncs_of(text)) if (limit_path(path)) paths.add(path)
      for (const path of sync_exclusions_of(text)) excluded.add(path)
    }
    for (const path of outermost([...paths]))
      if (!within(excluded, path)) await pull_path(path)
  }
  await restore_session_times(store, saved, root)
  const pending = await optional(`${saved}.pi/agent/deferred.json`)
  const applied = await apply_deferred(
    root,
    Object.fromEntries(
      Object.entries(pending ? JSON.parse(pending.toString()) : {}).filter(
        ([path]) => !within(keep_local, path)
      )
    )
  )
  return Object.assign(/** @type {[number, string[]]} */ ([count, applied]), {
    light
  })
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = '/realness'
  const [, , url] = process.argv
  if (!url || !/^https?:\/\//.test(url))
    throw new Error('usage: realness-recover <sync-url>')
  const owner = await stat(root)
  const { getuid, setgroups, setgid, setuid } = process
  if (getuid?.() === 0 && owner.uid !== 0) {
    if (!setgroups || !setgid || !setuid)
      throw new Error('dropping privileges needs setgroups, setgid, and setuid')
    setgroups([])
    setgid(owner.gid)
    setuid(owner.uid)
  }
  const state = await prepare_actor_state(root)
  const keep_local = (process.env.REALNESS_KEEP_LOCAL ?? '')
    .split(',')
    .map(path => path.trim())
    .filter(Boolean)
  const recovered = await recover(url, door_pass, root, { state, keep_local })
  const [count, applied] = recovered
  await mkdir(join(state, 'recovery'), { recursive: true })
  await write_file(join(state, 'recovery/url'), `${url}\n`)
  const left = recovered.light
    ? `, left ${recovered.light.skipped} in storage (light)`
    : ''
  console.info(
    `pulled ${count} files, replayed ${applied.length} pending edits${left}`
  )
}
