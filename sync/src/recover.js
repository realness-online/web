/** Read-only recovery through the normal sync client; no storage credential. */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { mkdir, readFile as read_file, stat, writeFile as write_file } from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { client } from './client.js'
import { apply_deferred, syncs_of } from './harness.js'
import { plans_path } from './harness-settings.js'
import { limit_path } from './recovery-pass.js'
import { STARTER_DIRECTORY } from './starter.js'

/** Node has no AF_VSOCK socket API; socat supplies only the socket transport. */
export const door_pass = (op = 'recovery-pass') => {
  return new Promise((resolve, reject) => {
    const child = exec_file('socat', ['-t', '10', '-', 'VSOCK-CONNECT:2:54'], { timeout: 10000 }, (error, stdout) => {
      if (error) return reject(error)
      const answer = JSON.parse(stdout.split('\n')[0])
      if (!answer.ok) return reject(new Error(answer.error || 'host door did not issue a pass'))
      resolve(answer.pass)
    })
    child.stdin.end(`${JSON.stringify({ op })}\n`)
  })
}

export const recover = async (url, issue, root = '/brayness', { state = join(root, 'artifacts/sync-recovery'), fetcher = fetch, starter = exists_sync(join(STARTER_DIRECTORY, 'starter.json')) ? STARTER_DIRECTORY : null } = {}) => {
  let pass = await issue()
  const claims = JSON.parse(Buffer.from(pass.split('.')[0], 'base64url').toString())
  const base = `can://people/${claims.phone}/`
  const store = client({ url, token: () => pass, fetcher: async (url, options) => {
    let response = await fetcher(url, options)
    if (response.status === 401) {
      pass = await issue()
      response = await fetcher(url, { ...options, headers: { ...options.headers, authorization: `Bearer ${pass}` } })
    }
    return response
  } })
  const exclude = path => !limit_path(path)
  let count = 0
  const pull = async (remote, local, options = {}) => {
    const report = await store.sync(local, remote, { state, pull_only: true, exclude, ...options })
    count += report.pulled.length + report.adopted.length
  }
  const optional = async path => {
    try { return await store.cat(path) } catch (error) {
      if (error.status === 403 || error.status === 404) return null
      throw error
    }
  }
  const pull_path = async path => {
    if (!limit_path(path)) throw new Error(`unsafe path limit: ${path}`)
    // A limited pass cannot list the parent of an allowed file.
    // Try the allowed folder first, then its exact file through the same sync.
    let names
    try { names = await store.walk(`${base}${path}/`) } catch (error) {
      if (error.status !== 404) throw error
    }
    if (names && Object.keys(names).length) return pull(`${base}${path}/`, join(root, path), { remote_files: names })
    const bytes = await optional(`${base}${path}`)
    if (!bytes) return
    await pull(`${base}${dirname(path) === '.' ? '' : `${dirname(path)}/`}`, join(root, dirname(path)), {
      only: [basename(path)], remote_files: { [basename(path)]: 'recovery' },
    })
  }
  let saved = base
  if (claims.paths !== undefined) {
    for (const path of claims.paths) await pull_path(path)
  } else if (await optional(`${base}harness/.ignore`) !== null) {
    saved = `${base}harness/`
    await pull(saved, root, { starter })
  } else {
    await pull(`${base}.pi/agent/sessions/`, join(root, '.pi/agent/sessions'))
    const folder = plans_path(root)
    await pull(`${base}${folder}/`, join(root, folder))
    const names = await store.walk(`${base}${folder}/`)
    const paths = new Set()
    for (const name of Object.keys(names).filter(name => name.endsWith('.md') && !name.includes('/'))) {
      for (const path of syncs_of(await read_file(join(root, folder, name), 'utf8'))) {
        if (limit_path(path)) paths.add(path)
      }
    }
    for (const path of paths) await pull_path(path)
  }
  const pending = await optional(`${saved}.pi/agent/deferred.json`)
  return [count, await apply_deferred(root, pending ? JSON.parse(pending.toString()) : {})]
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  const root = process.env.BRAYNESS_ROOT || '/brayness'
  const url = process.argv[2]
  if (!url || !/^https?:\/\//.test(url)) throw new Error('usage: brayness-recover <sync-url>')
  const owner = await stat(root)
  if (process.getuid() === 0 && owner.uid !== 0) {
    process.setgroups([])
    process.setgid(owner.gid)
    process.setuid(owner.uid)
  }
  const [count, applied] = await recover(url, door_pass, root)
  await mkdir(join(root, 'artifacts/sync-recovery'), { recursive: true })
  await write_file(join(root, 'artifacts/sync-recovery/url'), `${url}\n`)
  console.log(`pulled ${count} files, replayed ${applied.length} pending edits`)
}
