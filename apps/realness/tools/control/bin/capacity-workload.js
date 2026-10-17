import { setTimeout as delay } from 'node:timers/promises'
import { readFileSync as read_file } from 'node:fs'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer as create_server } from 'node:http'
import {
  networkInterfaces as network_interfaces,
  totalmem,
  freemem
} from 'node:os'
import { randomUUID as random_uuid } from 'node:crypto'

/* eslint-disable no-await-in-loop -- Memory touches, guest sampling, and browser cleanup are bounded ordered operations. */

const max_amount = 1024
const max_duration_ms = 180000
const bytes_per_mib = 1048576
const kib_per_mib = 1024
const page_bytes = 4096
const touch_interval_ms = 10
const sample_interval_ms = 250
const cleanup_ms = 5000
const iterations_per_unit = 1000
const checksum_multiplier = 31
const execute = promisify(exec_file)

const [kind, amount_text, duration_text] = process.argv.slice(2)
const amount = Number(amount_text)
const duration_ms = Number(duration_text)
if (
  !['memory', 'cpu', 'pi', 'browser'].includes(kind) ||
  !Number.isInteger(amount) ||
  amount < 1 ||
  amount > max_amount ||
  !Number.isInteger(duration_ms) ||
  duration_ms < 1 ||
  duration_ms > max_duration_ms
)
  throw new Error(
    'usage: node capacity-workload.js memory|cpu|pi|browser <MiB|iterations|1> <duration-ms>; max 1024 and 180000'
  )

const controller = new AbortController()
const interrupt = () => controller.abort(new Error('interrupted'))
process.once('SIGINT', interrupt)
process.once('SIGTERM', interrupt)
let guest_peak_mib = 0
const memory_source =
  process.platform === 'linux' ? 'proc-meminfo' : 'os-freemem'
const sample = () => {
  if (memory_source === 'os-freemem') {
    guest_peak_mib = Math.max(
      guest_peak_mib,
      (totalmem() - freemem()) / bytes_per_mib
    )
    return
  }
  const memory = read_file('/proc/meminfo', 'utf8')
  const total = Number(/^MemTotal:\s+(\d+) kB$/m.exec(memory)?.[1])
  const available = Number(/^MemAvailable:\s+(\d+) kB$/m.exec(memory)?.[1])
  if (
    !Number.isFinite(total) ||
    !Number.isFinite(available) ||
    total <= available
  )
    throw new Error('unknown guest memory')
  guest_peak_mib = Math.max(guest_peak_mib, (total - available) / kib_per_mib)
}
const started = performance.now()
const remaining_ms = () =>
  Math.max(1, Math.ceil(duration_ms - (performance.now() - started)))
const child = (binary, argv) => {
  const pending = execute(binary, argv, {
    timeout: remaining_ms(),
    signal: controller.signal,
    killSignal: 'SIGKILL'
  })
  pending.child.stdin?.end()
  return pending
}

const browser = async () => {
  const marker = `capacity-${random_uuid()}`
  const session = marker
  const server = create_server((_request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${marker}</title></head><body><main itemscope itemtype="https://schema.org/WebPage" itemid="/${marker}"><h1 itemprop="name">${marker}</h1></main></body></html>`
    )
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '0.0.0.0', () => resolve(undefined))
  })
  try {
    const address = Object.values(network_interfaces())
      .flat()
      .find(item => item?.family === 'IPv4' && !item.internal)?.address
    if (!address) throw new Error('no actor IPv4 address')
    const listening = server.address()
    if (!listening || typeof listening === 'string')
      throw new Error('actor page server has no TCP address')
    const { port } = listening
    await child('/usr/local/bin/agent-browser', [
      '--session',
      session,
      'open',
      `http://${address}:${port}/`
    ])
    const page = await child('/usr/local/bin/agent-browser', [
      '--session',
      session,
      'eval',
      'document.title'
    ])
    if (JSON.parse(page.stdout.trim()) !== marker)
      throw new Error('leased browser did not open the actor page')
  } finally {
    const failures = []
    for (const { binary, argv } of [
      {
        binary: '/usr/local/bin/agent-browser',
        argv: ['--session', session, 'close']
      },
      { binary: '/usr/local/bin/realness', argv: ['chrome', 'return'] }
    ])
      try {
        const result = await execute(binary, argv, {
          timeout: cleanup_ms,
          killSignal: 'SIGKILL'
        })
        if (
          binary === '/usr/local/bin/realness' &&
          result.stdout.trim() !== 'returned'
        )
          throw new Error('browser lease return was not confirmed')
      } catch (error) {
        failures.push(error)
      }

    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    if (failures.length)
      throw new AggregateError(failures, 'browser cleanup failed')
  }
  return { browser_verified: true, browser_released: true }
}

const work = async () => {
  if (kind === 'browser') return browser()
  if (kind === 'pi') {
    const result = await child('/usr/local/bin/realness', [
      '--mode',
      'json',
      '--no-session',
      '--no-tools',
      '--no-skills',
      '--no-context-files',
      'Reply with exactly: ready'
    ])
    process.stdout.write(`${result.stdout.trimEnd()}\n`)
    return {}
  }
  const until = performance.now() + duration_ms
  if (kind === 'memory') {
    const memory = Buffer.alloc(amount * bytes_per_mib, 1)
    sample()
    while (performance.now() < until) {
      controller.signal.throwIfAborted()
      for (let index = 0; index < memory.length; index += page_bytes)
        memory[index] ^= 1
      await delay(touch_interval_ms, undefined, { signal: controller.signal })
    }
    return { bytes: memory.length }
  }
  let checksum = 0
  while (performance.now() < until)
    for (let index = 0; index < amount * iterations_per_unit; index++)
      checksum = Math.imul(checksum + index, checksum_multiplier)
  return { checksum }
}

sample()
const monitor = new AbortController()
const sampling = (async () => {
  while (!monitor.signal.aborted) {
    try {
      await delay(sample_interval_ms, undefined, { signal: monitor.signal })
    } catch (error) {
      if (monitor.signal.aborted) return
      throw error
    }
    sample()
  }
})()
const results = await Promise.allSettled([
  work().finally(() => monitor.abort()),
  sampling
])
process.removeListener('SIGINT', interrupt)
process.removeListener('SIGTERM', interrupt)
const failed = results.find(result => result.status === 'rejected')
if (failed) throw failed.reason
sample()
const detail = results[0].status === 'fulfilled' ? results[0].value : {}
process.stdout.write(
  `${JSON.stringify({ type: 'capacity_workload', kind, duration_ms, elapsed_ms: performance.now() - started, guest_peak_mib, memory_source, ...detail })}\n`
)
