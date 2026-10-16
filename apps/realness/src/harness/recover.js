/** Read-only recovery through the normal sync client; no storage credential. */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import {
  mkdir,
  readFile as read_file,
  stat,
  utimes,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { client } from '#root/src/files/client.js'
import { apply_deferred, syncs_of } from './harness.js'
import { plans_path, state_path, runtime_sessions_path } from './settings.js'
import { prepare_actor_state } from './state.js'
import { limit_path } from '#root/src/files/paths.js'
import { STARTER_DIRECTORY } from '#root/src/files/starter.js'
import { light_policy, light_skips, write_skipped } from './light.js'
import { HTTP } from '#root/lib/http.js'
/* eslint-disable no-await-in-loop -- paths pull one at a time to bound memory on a small VM */

/** Node has no AF_VSOCK socket API; socat supplies only the socket transport. */
export const door_pass = (op = 'recovery-pass') =>
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
            new Error(answer.error || 'host door did not issue a pass')
          )
        resolve(answer.pass)
      }
    )
    if (child.stdin) child.stdin.end(`${JSON.stringify({ op })}\n`)
    else reject(new Error('socat has no stdin'))
  })

/**
 * Pull the harness back onto a light VM. Returns `[count, applied]`, with a
 * `light` property when the run used the path-limited light mode.
 * @returns {Promise<[number, string[]] & { light: { skipped: number } | null }>}
 */
export const recover = async (
  url,
  issue,
  root = '/realness',
  {
    state: state_option = join(root, state_path(root)),
    fetcher = fetch,
    starter = exists_sync(join(STARTER_DIRECTORY, 'starter.json'))
      ? STARTER_DIRECTORY
      : null
  } = {}
) => {
  const state = await prepare_actor_state(root, { state: state_option })
  let pass = await issue()
  const claims = JSON.parse(
    Buffer.from(pass.split('.')[0], 'base64url').toString()
  )
  const base = `can://people/${claims.phone}/`
  const store = client({
    url,
    token: () => pass,
    fetcher: async (url, options) => {
      let response = await fetcher(url, options)
      if (response.status === HTTP.UNAUTHORIZED) {
        pass = await issue()
        response = await fetcher(url, {
          ...options,
          headers: { ...options.headers, authorization: `Bearer ${pass}` }
        })
      }
      return response
    }
  })
  const exclude = path => !limit_path(path)
  let count = 0
  const pull = async (remote, local, options = {}) => {
    const report = await store.sync(local, remote, {
      state,
      pull_only: true,
      exclude,
      ...options
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
  const pull_path = async (path, base_url = base) => {
    const base = base_url
    if (!limit_path(path)) throw new Error(`unsafe path limit: ${path}`)
    let names
    try {
      names = await store.walk(`${base}${path}/`)
    } catch (error) {
      if (error.status !== HTTP.NOT_FOUND) throw error
    }
    if (names && Object.keys(names).length)
      return pull(`${base}${path}/`, join(root, path), {
        remote_files: names,
        baseline: true
      })
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
        exclude: path => !limit_path(path) || keep.has(path)
      })
    } else {
      await write_skipped(state, [])
      await pull(saved, root, { starter, baseline: true })
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
    ))
      for (const path of syncs_of(
        await read_file(join(root, folder, name), 'utf8')
      ))
        if (limit_path(path)) paths.add(path)

    for (const path of paths) await pull_path(path)
  }
  const session_folder = runtime_sessions_path(root)
  const times = await store
    .walk_meta(`${saved}${session_folder}/`)
    .catch(() => ({}))
  for (const [name, { updated }] of Object.entries(times)) {
    const at = new Date(updated)
    if (Number.isNaN(at.getTime())) continue
    await utimes(join(root, session_folder, name), at, at).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
  }
  const pending = await optional(`${saved}.pi/agent/deferred.json`)
  const applied = await apply_deferred(
    root,
    pending ? JSON.parse(pending.toString()) : {}
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
  const recovered = await recover(url, door_pass, root, { state })
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
