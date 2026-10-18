/* eslint-disable no-await-in-loop -- Startup, polling, and teardown follow dependency order. */
import { spawn, execFileSync as exec_file_sync } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import {
  mkdir,
  readFile as read_file,
  appendFile as append_file
} from 'node:fs/promises'
import { get as http_get } from 'node:http'
import { get as https_get } from 'node:https'
import path from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'
import { local_settings } from '#root/src/settings/environments.js'
import { out_path } from '#root/src/settings/output.js'
import { setTimeout as delay } from 'node:timers/promises'

const { root, frontend } = product_paths()
const project = `${root}/`
export const local_artifacts = out_path('local')
const secret_file = out_path('halo-pass-secret')
const model_secret_file = out_path('model-pass-secret')
const REQUEST_TIMEOUT_MS = 3000
const START_TIMEOUT_MS = 300_000
const POLL_MS = 500
const STOP_TIMEOUT_MS = 5000
const HTTP_OK = 200
/** The default HTTPS port, used when a URL leaves it out. */
const HTTPS_PORT = 443

/** Existing commands own each service; the launcher owns only its child process groups. */
export const local_plan = () => {
  const secure =
    exists_sync(path.join(frontend, 'realness.local-key.pem')) &&
    exists_sync(path.join(frontend, 'realness.local.pem'))
  const url = secure ? local_settings.secure_origin : local_settings.origin
  const probe_url = secure
    ? `https://127.0.0.1:${local_settings.https_port}`
    : `http://127.0.0.1:${local_settings.http_port}`
  return {
    url,
    services: [
      {
        name: 'sync',
        args: ['run', 'start:sync'],
        url: `http://127.0.0.1:${local_settings.sync_port}/health`,
        env: {
          PORT: String(local_settings.sync_port),
          LISTEN: '0.0.0.0',
          STORE: 'disk',
          SYNC_DIR: out_path('sync-data'),
          PROJECT: local_settings.cloud.project,
          ORIGINS: local_settings.cloud.services.origins
        }
      },
      {
        name: 'halo',
        args: ['run', 'realness', '--', 'local', 'halo', 'up'],
        url: `http://127.0.0.1:${local_settings.api_port}/v1/health`,
        persistent: true
      },
      {
        name: 'proxy',
        args: ['run', 'start:proxy'],
        url: `http://127.0.0.1:${local_settings.proxy_port}/health`,
        env: {
          PORT: String(local_settings.proxy_port),
          LISTEN: '127.0.0.1',
          STORE: 'disk',
          PROXY_DIR: out_path('proxy-data'),
          IDENTITY_PROJECT: local_settings.cloud.project,
          OPENROUTER_API_KEY_FILE: out_path('openrouter-key'),
          ORIGINS: local_settings.cloud.services.origins
        }
      },
      { name: 'workers', args: ['run', 'dev:frontend:workers'] },
      {
        name: 'gate',
        args: ['run', 'dev:gate'],
        url: `http://127.0.0.1:${local_settings.gate_port}/health`,
        env: {
          GATE_API_PORT: String(local_settings.api_port),
          SYNC_URL: `http://127.0.0.1:${local_settings.sync_port}`
        }
      },
      {
        name: 'frontend',
        args: ['run', 'dev:frontend', '--', '--mode', 'dev-local'],
        url: probe_url
      }
    ].map(service => ({ command: 'npm', cwd: project, ...service }))
  }
}

/**
 * Readiness checks never start a server. Only refused connections mean it is absent.
 * @param {string} url
 * @returns {Promise<{ status: number | undefined, body: string, headers: import('node:http').IncomingHttpHeaders } | null>}
 */
export const local_request = url =>
  new Promise((resolve, reject) => {
    const secure = url.startsWith('https:')
    const options = {
      timeout: REQUEST_TIMEOUT_MS,
      agent: false,
      ...(secure && { rejectUnauthorized: false })
    }
    const get = secure ? https_get : http_get
    const request = get(url, options, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
      })
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          body,
          headers: response.headers
        })
      )
      response.on('error', reject)
    })
    request.on('timeout', () =>
      request.destroy(new Error(`No response from ${url}`))
    )
    request.on('error', error => {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ECONNREFUSED')
        resolve(null)
      else reject(error)
    })
  })

/** Match manual worker watchers by script and working directory, never by PID alone. */
const worker_pid = () => {
  const rows = exec_file_sync('ps', ['-axo', 'pid=,command='], {
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
  for (const row of rows) {
    const [pid, ...words] = row.trim().split(/\s+/)
    if (
      !words.some(
        word =>
          word === 'scripts/watch-workers.js' ||
          word === path.join(frontend, 'scripts/watch-workers.js')
      )
    )
      continue
    const cwd = exec_file_sync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
      encoding: 'utf8'
    })
      .split('\n')
      .find(line => line.startsWith('n'))
      ?.slice(1)
    if (cwd === frontend) return Number(pid)
  }
  return null
}

/**
 * Whoever holds a port, as `pid (directory)`, so a refusal names the blocker.
 * @param {string} url
 */
const port_holder = url => {
  const port = Number(new URL(url).port || HTTPS_PORT)
  const listing = exec_file_sync(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
    { encoding: 'utf8' }
  ).trim()
  const [pid] = listing.split('\n')
  if (!pid) return null
  const directory = exec_file_sync(
    'lsof',
    ['-a', '-p', pid, '-d', 'cwd', '-Fn'],
    {
      encoding: 'utf8'
    }
  )
    .split('\n')
    .find(line => line.startsWith('n'))
    ?.slice(1)
  return directory ? `${pid} (${directory})` : pid
}

export const probe_local = async service => {
  if (service.name === 'workers') {
    const pid = worker_pid()
    return { running: Boolean(pid), ready: Boolean(pid) }
  }
  const reply = await local_request(service.url)
  if (!reply) return { running: false, ready: false }
  if (reply.status !== HTTP_OK) {
    const holder = port_holder(service.url)
    const port = new URL(service.url).port || String(HTTPS_PORT)
    throw new Error(
      holder
        ? `Port ${port} is taken by ${holder}, which answered ${reply.status}. Stop it, then run npm run local again.`
        : `${service.name} at ${service.url} answered ${reply.status}. Stop it, then run npm run local again.`
    )
  }
  if (service.name === 'halo')
    return { running: true, ready: Boolean(JSON.parse(reply.body).seed?.built) }
  if (service.name === 'gate' && reply.body.trim() !== 'ok')
    throw new Error(
      `Port ${local_settings.gate_port} is occupied by another service`
    )
  if (service.name === 'frontend') {
    if (!reply.body.includes('/@vite/client'))
      throw new Error(`${service.url} is not the Vite development server`)
    if (reply.headers['x-vite-mode'] !== 'dev-local')
      throw new Error(
        'The frontend is already running with another gate. Stop that dev server, then run npm run local again.'
      )
  }
  return { running: true, ready: true }
}

const launch_local = async service => {
  await mkdir(local_artifacts, { recursive: true })
  const env = { ...process.env, ...service.env }
  if (
    service.name === 'gate' ||
    service.name === 'sync' ||
    service.name === 'proxy'
  ) {
    env.HALO_PASS_SECRET = (await read_file(secret_file, 'utf8')).trim()
    if (!env.HALO_PASS_SECRET)
      throw new Error('The local halo pass secret is empty')
  }
  if (service.name === 'proxy') {
    env.MODEL_PASS_SECRET = (await read_file(model_secret_file, 'utf8')).trim()
    if (!env.MODEL_PASS_SECRET)
      throw new Error('The local model pass secret is empty')
  }
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const log_file = path.join(local_artifacts, `${service.name}.log`)
  child.stdout.on('data', chunk => {
    void append_file(log_file, chunk, { mode: 0o600 })
  })
  child.stderr.on('data', chunk => {
    void append_file(log_file, chunk, { mode: 0o600 })
  })
  child.on('error', error => {
    service.error = error.message
  })
  child.on('exit', (code, signal) => {
    service.exited = true
    service.code = code
    if (!service.stopping && (!service.persistent || code !== 0))
      service.error = `${service.name} exited (${signal ?? code}); see ${log_file}`
  })
  return child
}

const stop_local = async (child, service) => {
  service.stopping = true
  if (!child.pid) return
  const kill = signal => {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  kill('SIGTERM')
  const deadline = Date.now() + STOP_TIMEOUT_MS
  while (!service.exited && Date.now() < deadline) await delay(POLL_MS)
  kill('SIGKILL')
}

/**
 * One local service, as the stack tracks it.
 * @typedef {object} LocalService
 * @property {string} name
 * @property {string} url
 * @property {string} [state]
 * @property {number} [pid]
 * @property {boolean} [reused]
 * @property {boolean} [persistent]
 * @property {string} [error]
 */

/**
 * Startup and shutdown stay separate from the read-only terminal monitor.
 * @param {LocalService[]} services
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {(service: LocalService) => Promise<{ running: boolean, ready: boolean }>} [options.probe]
 * @param {(service: LocalService) => Promise<import('node:child_process').ChildProcess>} [options.launch]
 * @param {(child: import('node:child_process').ChildProcess, service: LocalService) => Promise<void>} [options.stop]
 * @param {typeof delay} [options.pause]
 * @param {() => number} [options.now]
 * @param {(service: LocalService) => void} [options.changed]
 */
export const start_local = async (
  services,
  {
    signal,
    probe = probe_local,
    launch = launch_local,
    stop = stop_local,
    pause = delay,
    now = Date.now,
    changed = () => {}
  } = {}
) => {
  const owned = []
  const cleanup = async () => {
    for (const { child, service } of owned.toReversed())
      await stop(child, service)
  }
  const wait_ready = async service => {
    const deadline = now() + START_TIMEOUT_MS
    while (!(await probe(service)).ready) {
      signal?.throwIfAborted()
      if (service.error) throw new Error(service.error)
      if (now() >= deadline)
        throw new Error(
          `${service.name} did not become ready; see ${local_artifacts}`
        )
      await pause(POLL_MS, null, { signal })
    }
    if (service.error) throw new Error(service.error)
    service.state = 'running'
    changed(service)
  }
  try {
    const initial = await Promise.all(services.map(service => probe(service)))
    for (const [index, service] of services.entries()) {
      signal?.throwIfAborted()
      const state = initial[index]
      service.state = state.ready ? 'running' : 'starting'
      service.reused = state.running
      changed(service)
      if (!state.running) {
        const child = await launch(service)
        service.pid = child.pid
        if (!service.persistent) owned.push({ child, service })
        else owned.push({ child, service, bootstrap: true })
      }
      if (service.name === 'sync') await wait_ready(service)
    }
    await Promise.all(
      services
        .filter(service => service.name !== 'sync')
        .map(service => wait_ready(service))
    )
    return async () => {
      const transient = owned.filter(
        item => !item.bootstrap || !item.service.exited
      )
      for (const { child, service } of transient.toReversed())
        await stop(child, service)
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
