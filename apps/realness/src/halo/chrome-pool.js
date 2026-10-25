import { spawn as spawn_process } from 'node:child_process'
import {
  closeSync as close_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  openSync as open_sync,
  rmSync as rm_sync,
  statSync as stat_sync
} from 'node:fs'
import { join } from 'node:path'
import * as firecracker from './firecracker.js'
import { run } from './syscalls.js'
import { MIB, MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- polling waits between tries; copies stop one at a time */

const MAX_COPIES = 250
const POLL_MS = 100
const SETTLE_POLL_MS = 250
const SEED_BOOT_S = 120
const RESTORE_S = 30
const LOAD_LIMIT_MS = 30_000
const SETTLE_MS = 10_000
const EVAL_TIMEOUT_MS = 15_000
const SETTLED_FOR_MS = 500
const DEFAULT_MIB = 1024

const SEED_TAP = 'fc-chrome1'
const SEED_GATEWAY = '172.18.1.1'
const SEED_GUEST = '172.18.1.2'
const SEED_MAC = '06:00:AC:12:01:02'
export const DEVTOOLS_PORT = 9222
const DISK = 'rootfs.ext4'
const sleep = ms =>
  new Promise(done => {
    setTimeout(done, ms)
  })

/** A copy's namespace and outside addresses. n is 1..250. */
export const copy_net = n => {
  if (!Number.isInteger(n) || n < 1 || n > MAX_COPIES)
    throw new Error(`copy number ${n} is out of range`)
  return {
    ns: `brc-${n}`,
    outside: `brc-${n}-o`,
    inside: `brc-${n}-i`,
    gateway: `172.19.${n}.1`,
    address: `172.19.${n}.2`
  }
}

/** The commands that build a copy's namespace, in order. Pure, so tests read them. */
export const namespace_commands = n => {
  const { ns, outside, inside, gateway, address } = copy_net(n)
  const inns = (...argv) => ['ip', 'netns', 'exec', ns, ...argv]
  return [
    ['ip', 'netns', 'add', ns],
    ['ip', 'link', 'add', outside, 'type', 'veth', 'peer', 'name', inside],
    ['ip', 'link', 'set', inside, 'netns', ns],
    ['ip', 'addr', 'add', `${gateway}/30`, 'dev', outside],
    ['ip', 'link', 'set', outside, 'up'],
    inns('ip', 'addr', 'add', `${address}/30`, 'dev', inside),
    inns('ip', 'link', 'set', inside, 'up'),
    inns('ip', 'link', 'set', 'lo', 'up'),
    inns('ip', 'route', 'add', 'default', 'via', gateway),
    inns('ip', 'tuntap', 'add', 'dev', SEED_TAP, 'mode', 'tap'),
    inns('ip', 'addr', 'add', `${SEED_GATEWAY}/30`, 'dev', SEED_TAP),
    inns('ip', 'link', 'set', SEED_TAP, 'up'),
    inns('sysctl', '-q', '-w', 'net.ipv4.ip_forward=1'),
    inns(
      'iptables',
      '-t',
      'nat',
      '-A',
      'PREROUTING',
      '-i',
      inside,
      '-j',
      'DNAT',
      '--to-destination',
      SEED_GUEST
    ),
    inns(
      'iptables',
      '-t',
      'nat',
      '-A',
      'POSTROUTING',
      '-o',
      inside,
      '-j',
      'MASQUERADE'
    )
  ]
}

const firecracker_in = (ns, binary, cwd, api_sock, log_path) => {
  const log = open_sync(log_path, 'a')
  try {
    const argv = ns
      ? ['ip', 'netns', 'exec', ns, binary, '--api-sock', api_sock]
      : [binary, '--api-sock', api_sock]
    return spawn_process(argv[0], argv.slice(1), {
      cwd,
      stdio: ['ignore', log, log]
    })
  } finally {
    close_sync(log)
  }
}

/** DevTools' /json/version at `address`, or throw after `seconds`. */
const devtools = async (address, seconds = 5) => {
  const deadline = Date.now() + seconds * MS_PER_SECOND
  for (;;) {
    try {
      const reply = await fetch(
        `http://${address}:${DEVTOOLS_PORT}/json/version`,
        { signal: AbortSignal.timeout(MS_PER_SECOND) }
      )
      if (reply.ok) return await reply.json()
    } catch {}
    if (Date.now() > deadline)
      throw new Error(
        `no DevTools on ${address}:${DEVTOOLS_PORT} after ${seconds}s`
      )
    await sleep(POLL_MS)
  }
}

/** Remove a copy's namespace and veth; safe to repeat. */
const remove_namespace = n => {
  const { ns, outside } = copy_net(n)
  run(['ip', 'link', 'del', outside], { check: false })
  run(['ip', 'netns', 'del', ns], { check: false })
}

export class ChromePool {
  /** @type {string} */
  root
  /** @type {string} */
  image
  /** @type {string} */
  kernel
  /** @type {string} */
  binary
  /** @type {number} */
  mib
  /** @type {number} */
  vcpus
  /** @type {number} */
  max
  /** @type {string} */
  seed_dir
  /** @type {Map<number, { dir: string, pid: number | null, address: string }>} */
  copies = new Map()

  /**
   * root: where the seed and copies live. image: the Chrome ext4. Copies are
   * numbered 1..max; the seed boots in namespace brc-0's place, number `max + 1`.
   */
  constructor({
    root,
    image = '/opt/fc/chrome.ext4',
    kernel = '/opt/fc/vmlinux-6.1.155',
    binary = '/opt/fc/firecracker',
    mib = DEFAULT_MIB,
    vcpus = 2,
    max = 8
  }) {
    Object.assign(this, { root, image, kernel, binary, mib, vcpus, max })
    this.seed_dir = join(root, 'seed')
    this.copies = new Map()
  }

  get seeded() {
    return (
      exists_sync(join(this.seed_dir, 'chrome.state')) &&
      exists_sync(join(this.seed_dir, 'chrome.mem'))
    )
  }

  #namespace(n) {
    remove_namespace(n)
    for (const argv of namespace_commands(n)) run(argv)
  }

  /** Boot the image once, wait for DevTools, snapshot warm. The disk path is relative, so copies use their own. */
  async seed() {
    const n = this.max + 1
    const { ns, address } = copy_net(n)
    rm_sync(this.seed_dir, { recursive: true, force: true })
    mkdir_sync(this.seed_dir, { recursive: true })
    run([
      'cp',
      '--reflink=auto',
      '--sparse=always',
      this.image,
      join(this.seed_dir, DISK)
    ])
    this.#namespace(n)
    const api_sock = join(this.seed_dir, 'api.sock')
    const child = firecracker_in(
      ns,
      this.binary,
      this.seed_dir,
      api_sock,
      join(this.seed_dir, 'firecracker.log')
    )
    const started = performance.now()
    try {
      await firecracker.wait_for_api_socket(api_sock)
      const api = new firecracker.Api(api_sock)
      await firecracker.boot(api, {
        kernel: this.kernel,
        disk: DISK,
        tap: SEED_TAP,
        mac: SEED_MAC,
        vcpus: this.vcpus,
        mib: this.mib
      })
      const version = await devtools(address, SEED_BOOT_S)
      const boot_s = (performance.now() - started) / MS_PER_SECOND
      await firecracker.pause(api)
      await firecracker.create_snapshot(api, 'chrome.state', 'chrome.mem')
      return {
        browser: version.Browser,
        boot_s,
        mem_mib: Math.round(
          stat_sync(join(this.seed_dir, 'chrome.mem')).size / MIB
        )
      }
    } finally {
      await firecracker.terminate(child.pid)
      remove_namespace(n)
      rm_sync(api_sock, { force: true })
    }
  }

  #free() {
    for (let n = 1; n <= this.max; n++) if (!this.copies.has(n)) return n
    throw new Error(`all ${this.max} Chrome copies are leased`)
  }

  /** Restore a fresh copy; resolves once its DevTools answers at its own address. */
  async restore() {
    if (!this.seeded)
      await (this.seeding ??= this.seed().finally(() => (this.seeding = null)))
    const n = this.#free()
    const { ns, address } = copy_net(n)
    const dir = join(this.root, `copy-${n}`)
    this.copies.set(n, { dir, pid: null, address })
    const timing = {}
    try {
      rm_sync(dir, { recursive: true, force: true })
      mkdir_sync(dir, { recursive: true })
      let clock = performance.now()
      run([
        'cp',
        '--reflink=auto',
        '--sparse=always',
        join(this.seed_dir, DISK),
        join(dir, DISK)
      ])
      timing.disk_s = (performance.now() - clock) / MS_PER_SECOND
      this.#namespace(n)
      clock = performance.now()
      const api_sock = join(dir, 'api.sock')
      const child = firecracker_in(
        ns,
        this.binary,
        dir,
        api_sock,
        join(dir, 'firecracker.log')
      )
      const copy = this.copies.get(n)
      if (!copy) throw new Error(`chrome copy ${n} vanished before it started`)
      copy.pid = child.pid ?? null
      await firecracker.wait_for_api_socket(api_sock)
      await firecracker.load_snapshot(
        new firecracker.Api(api_sock),
        join(this.seed_dir, 'chrome.state'),
        join(this.seed_dir, 'chrome.mem'),
        SEED_TAP
      )
      const version = await devtools(address, RESTORE_S)
      timing.restore_s = (performance.now() - clock) / MS_PER_SECOND
      return {
        n,
        address,
        devtools: `http://${address}:${DEVTOOLS_PORT}`,
        browser: version.Browser,
        pid: child.pid,
        ...timing
      }
    } catch (error) {
      await this.destroy(n)
      throw error
    }
  }

  /** Stop a copy and delete everything it had; a returned copy is never reused. */
  async destroy(n) {
    const copy = this.copies.get(n)
    if (!copy) return
    if (copy.pid) await firecracker.terminate(copy.pid)
    remove_namespace(n)
    rm_sync(copy.dir, { recursive: true, force: true })
    this.copies.delete(n)
  }

  async destroy_all() {
    for (const n of Array.from(this.copies.keys())) await this.destroy(n)
  }
}

/**
 * Open `url` in the Chrome at `address`, wait for load, return the document's
 * status and HTML. Standard library only: Node's WebSocket speaks DevTools.
 */
export const render_page = async (
  address,
  url,
  { limit = LOAD_LIMIT_MS, settle_ms = SETTLE_MS } = {}
) => {
  const { webSocketDebuggerUrl } = await devtools(address)
  const socket = new WebSocket(webSocketDebuggerUrl)
  await new Promise((done, fail) => {
    socket.onopen = done
    socket.onerror = () => fail(new Error('DevTools socket failed'))
  })
  let next = 0
  const waiting = new Map()
  const events = []
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && waiting.has(message.id)) {
      const { done, fail } = waiting.get(message.id)
      waiting.delete(message.id)
      if (message.error) fail(new Error(message.error.message))
      else done(message.result)
    } else if (message.method) events.push(message)
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((done, fail) => {
      const id = ++next
      const timer = setTimeout(
        () => (
          waiting.delete(id),
          fail(new Error(`${method}: no reply in 15s`))
        ),
        EVAL_TIMEOUT_MS
      )
      waiting.set(id, {
        done: v => (clearTimeout(timer), done(v)),
        fail: e => (clearTimeout(timer), fail(e))
      })
      socket.send(
        JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })
      )
    })
  try {
    const { targetId } = await send('Target.createTarget', {
      url: 'about:blank'
    })
    const { sessionId } = await send('Target.attachToTarget', {
      targetId,
      flatten: true
    })
    await send('Page.enable', {}, sessionId)
    await send('Network.enable', {}, sessionId)
    await send('Page.navigate', { url }, sessionId)
    const deadline = Date.now() + limit
    while (
      !events.some(
        e => e.sessionId === sessionId && e.method === 'Page.loadEventFired'
      )
    ) {
      if (Date.now() > deadline) break
      await sleep(50)
    }
    const status =
      events.find(
        e =>
          e.sessionId === sessionId &&
          e.method === 'Network.responseReceived' &&
          e.params.type === 'Document'
      )?.params.response.status ?? null
    const settle = Date.now() + settle_ms
    while (Date.now() < settle) {
      const { result } = await send(
        'Runtime.evaluate',
        {
          expression: "(document.body?.innerText ?? '').length",
          returnByValue: true
        },
        sessionId
      )
      if (result.value >= SETTLED_FOR_MS) break
      await sleep(SETTLE_POLL_MS)
    }
    const { result } = await send(
      'Runtime.evaluate',
      { expression: 'document.documentElement.outerHTML', returnByValue: true },
      sessionId
    )
    return { status, html: result.value ?? '' }
  } finally {
    socket.close()
  }
}
