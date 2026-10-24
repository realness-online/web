#!/usr/bin/env node
/**
 * lc1: the stack runs on this Mac without our cloud.
 *
 * Needs `npm run local` running. While it exercises every service, it samples
 * the outbound connections of the stack's processes and of the halo VM.
 * Reaching Google (Cloud Run, Firebase, storage) fails: that would mean the
 * stack cannot be hosted anywhere else. Other outside traffic is only listed.
 *
 *   npm run check:local            exercise, then watch 20 seconds idle
 *   IDLE_SECONDS=120 npm run check:local
 */
import { execFile as exec_file } from 'node:child_process'
import { randomUUID as random_uuid } from 'node:crypto'
import { lookup, reverse } from 'node:dns/promises'
import { isIP as is_ip } from 'node:net'
import { promisify } from 'node:util'
import { client } from '#root/src/files/client.js'
import { local_owner, local_token_source } from '#root/src/files/target.js'
import { local_plan } from '#root/src/command/local-stack.js'
import { local_settings } from '#root/src/settings/environments.js'

const run = promisify(exec_file)
const SAMPLE_MS = 500
const VM_SAMPLE_MS = 3000
const IDLE_MS = Number(process.env.IDLE_SECONDS ?? 20) * 1000
const VM = process.env.LIMA_INSTANCE ?? 'fc-local'
/** The one place a local stack may call out to: models. */
const ALLOWED_HOSTS = ['openrouter.ai']
const GOOGLE = /1e100\.net|google|gstatic|firebase|run\.app/i

const quiet = async (file, args) =>
  (await run(file, args).catch(error => error)).stdout ?? ''

const local_address = ip => {
  const bare = ip.replace(/^\[|\]$/g, '').replace(/^::ffff:/, '')
  if (bare === '*' || bare === '::1' || bare.startsWith('127.')) return true
  if (/^(10\.|192\.168\.|169\.254\.)/.test(bare)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(bare)) return true
  return /^(fe80|fd|fc)/i.test(bare)
}

/** The stack's processes: whoever listens on its ports, their children, Lima. */
const stack_pids = async () => {
  const ports = [
    ...local_plan().services.flatMap(({ url }) =>
      url ? [new URL(url).port || '443'] : []
    ),
    String(local_settings.terminal_port)
  ]
  const listening = await quiet('lsof', [
    '-nP',
    '-t',
    '-sTCP:LISTEN',
    ...ports.flatMap(port => ['-i', `TCP:${port}`])
  ])
  const pids = new Set(listening.split('\n').filter(Boolean))
  for (const pid of (await quiet('pgrep', ['-f', `limactl.*${VM}`])).split(
    '\n'
  ))
    if (pid) pids.add(pid)
  for (let grew = true; grew;) {
    grew = false
    const children = await quiet('pgrep', ['-P', [...pids].join(',')])
    for (const pid of children.split('\n'))
      if (pid && !pids.has(pid)) grew = pids.add(pid)
  }
  return [...pids]
}

/** Remote ends from `lsof -i` lines, with the command that holds each. */
const host_remotes = async pids => {
  const text = await quiet('lsof', ['-nP', '-a', '-p', pids.join(','), '-i'])
  return text
    .split('\n')
    .slice(1)
    .flatMap(line => {
      const remote = line.match(/->(\[[^\]]+\]|[^:\s]+):(\d+)/)
      return remote
        ? [{ ip: remote[1], port: remote[2], by: line.split(/\s+/)[0] }]
        : []
    })
}

/** Remote ends seen inside the halo VM. */
const vm_remotes = async () => {
  const text = await quiet('limactl', [
    'shell',
    VM,
    '--',
    'ss',
    '-Htn',
    'state',
    'established'
  ])
  return text.split('\n').flatMap(line => {
    const peer = line.trim().split(/\s+/).at(-1)
    const found = peer?.match(/^(.*):(\d+)$/)
    return found ? [{ ip: found[1], port: found[2], by: `vm:${VM}` }] : []
  })
}

const allowed_ips = async () => {
  const ips = new Set()
  for (const host of ALLOWED_HOSTS)
    for (const { address } of await lookup(host, { all: true }).catch(() => []))
      ips.add(address)
  return ips
}

/** Every service answers, and a file round-trips through local sync. */
const exercise = async () => {
  const results = []
  const step = async (name, act) => {
    try {
      await act()
      results.push({ name, ok: true })
    } catch (error) {
      results.push({ name, ok: false, error: error.message })
    }
  }
  for (const { name, url } of local_plan().services) {
    if (!url) continue
    await step(`${name} answers`, async () => {
      if (url.startsWith('https:')) {
        await run('curl', ['-skf', '-o', '/dev/null', url])
        return
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
    })
  }
  const store = client({
    url: `http://127.0.0.1:${local_settings.sync_port}`,
    token: local_token_source(),
    phone: local_owner()
  })
  const path = `can://~/.lc1-check/${random_uuid()}.txt`
  const body = `lc1 ${new Date().toISOString()}`
  await step(`sync round-trip as ${local_owner()}`, async () => {
    await store.put(path, body)
    const read = (await store.cat(path)).toString('utf8')
    await store.rm(path)
    if (read !== body) throw new Error('read back different bytes')
  })
  return results
}

const pids = await stack_pids()
if (!pids.length) {
  console.error('lc1: no local stack is listening; start `npm run local`')
  process.exit(1)
}

const seen = new Map()
const note = list => {
  for (const remote of list)
    if (!local_address(remote.ip))
      seen.set(`${remote.ip}:${remote.port} ${remote.by}`, remote)
}
let watching = true
const sample = async (take, every) => {
  while (watching) {
    note(await take())
    await new Promise(done => setTimeout(done, every))
  }
}
const samplers = [
  sample(() => host_remotes(pids), SAMPLE_MS),
  sample(vm_remotes, VM_SAMPLE_MS)
]

const results = await exercise()
await new Promise(done => setTimeout(done, IDLE_MS))
watching = false
await Promise.all(samplers)

const allowed = await allowed_ips()
const leaks = []
for (const remote of seen.values()) {
  const bare = remote.ip.replace(/^\[|\]$/g, '')
  if (allowed.has(bare)) continue
  const names = is_ip(bare) ? await reverse(bare).catch(() => []) : []
  leaks.push({ ...remote, names, google: names.some(n => GOOGLE.test(n)) })
}

for (const { name, ok, error } of results)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${error ? `: ${error}` : ''}`)
console.log(
  `watched ${pids.length} processes and ${VM} for ${Math.round(IDLE_MS / 1000)}s after the run`
)
for (const leak of leaks)
  console.log(
    `${leak.google ? 'GOOGLE' : 'outside'} ${leak.by} -> ${leak.ip}:${leak.port} ${leak.names.join(' ')}`
  )
const failed =
  results.some(({ ok }) => !ok) || leaks.some(({ google }) => google)
console.log(
  failed
    ? 'lc1 failed'
    : 'lc1 passed: everything answered, nothing needed our cloud'
)
process.exit(failed ? 1 : 0)
