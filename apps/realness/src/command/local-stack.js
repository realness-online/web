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
import { pathToFileURL as path_to_file_url } from 'node:url'
import { product_paths } from '#root/src/settings/layout.js'
import { local_settings } from '#root/src/settings/environments.js'
import { out_path } from '#root/src/settings/output.js'
import { setTimeout as delay } from 'node:timers/promises'

const { root, frontend, app } = product_paths()
const project = `${root}/`
export const local_artifacts = out_path('local')
const secret_file = out_path('host-pass-secret')
const REQUEST_TIMEOUT_MS = 3000
const START_TIMEOUT_MS = 300_000
const POLL_MS = 500
const STOP_TIMEOUT_MS = 5000
const HTTP_OK = 200

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
        name: 'host',
        args: ['run', 'webspace', '--', 'local', 'host', 'up'],
        url: `http://127.0.0.1:${local_settings.api_port}/v1/health`,
        persistent: true
      },
      { name: 'workers', args: ['run', 'dev:frontend:workers'] },
      {
        name: 'gate',
        args: ['run', 'dev:gate'],
        url: `http://127.0.0.1:${local_settings.gate_port}/health`,
        env: { GATE_API_PORT: String(local_settings.api_port) }
      },
      {
        name: 'frontend',
        args: ['run', 'dev:frontend'],
        url: probe_url,
        env: { BRAYNESS_LOCAL: '1', VITE_BRAYNESS_GATE_URL: `${url}/gate` }
      }
    ].map(service => ({ command: 'npm', cwd: project, ...service }))
  }
}

/** Readiness checks never start a server. Only refused connections mean it is absent. */
export const local_request = url =>
  new Promise((resolve, reject) => {
    const get = url.startsWith('https:') ? https_get : http_get
    const request = get(
      url,
      { rejectUnauthorized: false, timeout: REQUEST_TIMEOUT_MS, agent: false },
      response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', chunk => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode, body }))
        response.on('error', reject)
      }
    )
    request.on('timeout', () =>
      request.destroy(new Error(`No response from ${url}`))
    )
    request.on('error', error => {
      if (error.code === 'ECONNREFUSED') resolve(null)
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

export const probe_local = async service => {
  if (service.name === 'workers') {
    const pid = worker_pid()
    return { running: Boolean(pid), ready: Boolean(pid) }
  }
  const reply = await local_request(service.url)
  if (!reply) return { running: false, ready: false }
  if (reply.status !== HTTP_OK)
    throw new Error(
      `${service.name}: ${service.url} answered ${reply.status}; leave the existing service untouched`
    )
  if (service.name === 'host')
    return { running: true, ready: Boolean(JSON.parse(reply.body).seed?.built) }
  if (service.name === 'gate' && reply.body.trim() !== 'ok')
    throw new Error(`Port ${local_settings.gate_port} is occupied by another service`)
  if (service.name === 'frontend') {
    if (!reply.body.includes('/@vite/client'))
      throw new Error(`${service.url} is not the Vite development server`)
    const module = await local_request(
      `${service.url}/@fs${path_to_file_url(path.join(app, 'utils/brayness-gate.js')).pathname}`
    )
    if (!module?.body.includes(service.env.VITE_BRAYNESS_GATE_URL))
      throw new Error(
        'The frontend is already running with another gate. Stop that dev server, then run npm run local again.'
      )
  }
  return { running: true, ready: true }
}

const launch_local = async service => {
  await mkdir(local_artifacts, { recursive: true })
  const env = { ...process.env, ...service.env }
  if (service.name === 'gate') {
    env.HOST_PASS_SECRET = (await read_file(secret_file, 'utf8')).trim()
    if (!env.HOST_PASS_SECRET)
      throw new Error('The local host pass secret is empty')
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

/** Startup and shutdown stay separate from the read-only terminal monitor. */
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
