import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  statSync as stat_sync
} from 'node:fs'
import { join } from 'node:path'
import { setInterval as every } from 'node:timers/promises'
import { HTTP } from '#root/lib/http.js'
import { KIB, MIB, MS_PER_SECOND } from '#root/lib/units.js'
import * as firecracker from '#root/src/halo/firecracker.js'
import * as syscalls from '#root/src/halo/syscalls.js'

const NET = '172.18'
const DEFAULT_MIB = 1024
const HEX = 16
/** utime and stime are fields 14 and 15 of /proc/pid/stat, after the name. */
const STAT_TIMES = { start: 11, end: 13 }
const CLOCK_TICKS = 100
const PROBE_MS = 1000
const POLL_MS = 100
const LOAD_POLL_MS = 20
const BOOT_LIMIT_S = 120
const RESTORE_LIMIT_S = 30
const RENDER_LIMIT_MS = 30_000
const REPLY_LIMIT_MS = 15_000
const VIEWPORT = { width: 1280, height: 800 }
const SNIFF_CHARS = 2000
const THIN_CHARS = 200
const PORT = 9222
const FC = '/opt/fc/firecracker'
const KERNEL = '/opt/fc/vmlinux-6.1.155'
const IMAGE = '/opt/fc/chrome.ext4'
const BLOCKED =
  /just a moment|attention required|verify you are human|access denied|are you a robot|captcha|enable javascript and cookies/i

export const seconds = since =>
  Number(((performance.now() - since) / MS_PER_SECOND).toFixed(2))
export const mib = bytes => Math.round(bytes / MIB)

/** A process's resident memory, bytes. @param {number} pid */
export const rss = pid => {
  const match = /VmRSS:\s+(\d+)/.exec(
    read_file_sync(`/proc/${pid}/status`, 'utf8')
  )
  if (!match) throw new Error(`no VmRSS for pid ${pid}`)
  return Number(match[1]) * KIB
}

/** A process's user plus system CPU, seconds: what the halo paid for the VM. */
export const cpu = pid => {
  const stat = read_file_sync(`/proc/${pid}/stat`, 'utf8')
  const [utime, stime] = stat
    .slice(stat.lastIndexOf(') ') + 2)
    .split(' ')
    .slice(STAT_TIMES.start, STAT_TIMES.end)
    .map(Number)
  return (utime + stime) / CLOCK_TICKS
}

export class ChromeVm {
  /** @type {string} */
  work
  /** @type {number} */
  mib
  /** @type {number} */
  vcpus
  /** @type {string | undefined} */
  huge_pages
  /** @type {number[]} */
  pids
  /** @type {string} */
  tap
  /** @type {string} */
  address
  /** @type {string} */
  mac
  /** @type {string} */
  state
  /** @type {string} */
  mem
  /** @type {string} */
  api_sock
  /** @type {import('node:child_process').ChildProcess | undefined} */
  child
  /** @type {import('#root/src/halo/firecracker.js').Api | undefined} */
  api

  /** @param {{ work: string, mib?: number, vcpus?: number, huge_pages?: string }} options */
  constructor({ work, mib = DEFAULT_MIB, vcpus = 2, huge_pages }) {
    syscalls.require_root('creating TAPs and Firecracker')
    mkdir_sync(work, { recursive: true })
    Object.assign(this, { work, mib, vcpus, huge_pages, pids: [] })
    this.tap = syscalls.free_tap('fc-chrome')
    this.address = syscalls.tap_guest(this.tap, NET)
    const index = /\d+$/.exec(this.tap)
    if (!index) throw new Error(`tap name ${this.tap} has no trailing number`)
    this.mac = `06:00:AC:12:${Number(index[0]).toString(HEX).padStart(2, '0').toUpperCase()}:02`
    this.state = join(work, 'chrome.state')
    this.mem = join(work, 'chrome.mem')
    syscalls.create_tap(this.tap, NET)
  }

  spawn() {
    const api_sock = join(this.work, 'api.sock')
    rm_sync(api_sock, { force: true })
    this.child = firecracker.spawn(
      FC,
      this.work,
      api_sock,
      join(this.work, 'firecracker.log')
    )
    this.pids.push(this.pid)
    this.api_sock = api_sock
  }

  /** The Firecracker pid, for CPU and RSS reads. Fails loudly before spawn. */
  get pid() {
    if (!this.child?.pid) throw new Error('the VM has not been spawned')
    return this.child.pid
  }

  /** DevTools answers, or throw after `limit` seconds. */
  async devtools(limit = 5) {
    for await (const asked_at of every(POLL_MS, Date.now())) {
      const reply = await fetch(`http://${this.address}:${PORT}/json/version`, {
        signal: AbortSignal.timeout(PROBE_MS)
      }).catch(() => null)
      if (reply?.ok) return reply.json()
      if (Date.now() - asked_at > limit * MS_PER_SECOND)
        throw new Error(
          `no DevTools on ${this.address}:${PORT} after ${limit}s`
        )
    }
    throw new Error(`no DevTools on ${this.address}:${PORT}`)
  }

  /** A cold boot from a fresh copy of the image, until DevTools answers. */
  async boot() {
    const disk = join(this.work, 'rootfs.ext4')
    syscalls.run(['cp', '--reflink=auto', '--sparse=always', IMAGE, disk])
    this.spawn()
    await firecracker.wait_for_api_socket(this.api_sock)
    this.api = new firecracker.Api(this.api_sock)
    await firecracker.boot(this.api, {
      kernel: KERNEL,
      disk,
      tap: this.tap,
      mac: this.mac,
      vcpus: this.vcpus,
      mib: this.mib,
      huge_pages: this.huge_pages
    })
    return this.devtools(BOOT_LIMIT_S)
  }

  /** Pause, write state and memory, stop this Firecracker. */
  async snapshot() {
    await firecracker.pause(this.api)
    await firecracker.create_snapshot(this.api, this.state, this.mem)
    await firecracker.terminate(this.pid)
    return { mem_mib: mib(stat_sync(this.mem).size) }
  }

  /** A fresh Firecracker resumes the snapshot on the same TAP, until DevTools answers. */
  async restore() {
    this.spawn()
    await firecracker.wait_for_api_socket(this.api_sock)
    await firecracker.load_snapshot(
      new firecracker.Api(this.api_sock),
      this.state,
      this.mem,
      this.tap
    )
    return this.devtools(RESTORE_LIMIT_S)
  }

  /**
   * Open `url` in a new tab, wait for load, read its text, screenshot, close.
   * `ok` means it loaded with real text and no interstitial.
   */
  /**
   * Load a URL in the running VM. A failure carries `ok: false` and a reason;
   * only a success fills title, chars, and png.
   * @param {string} url
   * @param {{ limit?: number, screenshot?: boolean, keep_text?: boolean }} [options]
   * @returns {Promise<{ ok: boolean, reason: string | null, status?: number, load: number, title?: string, chars?: number, png?: Buffer | null, text?: string }>}
   */
  async render(
    url,
    { limit = RENDER_LIMIT_MS, screenshot = true, keep_text = false } = {}
  ) {
    const { webSocketDebuggerUrl } = await this.devtools()
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
        const timer = setTimeout(() => {
          waiting.delete(id)
          fail(
            new Error(
              `${method}: no reply in ${REPLY_LIMIT_MS / MS_PER_SECOND}s`
            )
          )
        }, REPLY_LIMIT_MS)
        waiting.set(id, {
          done: value => (clearTimeout(timer), done(value)),
          fail: error => (clearTimeout(timer), fail(error))
        })
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
            ...(sessionId && { sessionId })
          })
        )
      })
    const start = performance.now()
    let targetId
    try {
      ;({ targetId } = await send('Target.createTarget', {
        url: 'about:blank'
      }))
      const { sessionId } = await send('Target.attachToTarget', {
        targetId,
        flatten: true
      })
      await send('Page.enable', {}, sessionId)
      await send('Network.enable', {}, sessionId)
      await send(
        'Emulation.setDeviceMetricsOverride',
        { ...VIEWPORT, deviceScaleFactor: 1, mobile: false },
        sessionId
      )
      await send('Page.navigate', { url }, sessionId)
      const loaded = () =>
        events.some(
          event =>
            event.sessionId === sessionId &&
            event.method === 'Page.loadEventFired'
        )
      for await (const navigated_at of every(LOAD_POLL_MS, Date.now())) {
        if (loaded()) break
        if (Date.now() - navigated_at > limit)
          return { ok: false, reason: 'timeout', load: seconds(start) }
      }
      const load = seconds(start)
      const status = events.find(
        event =>
          event.sessionId === sessionId &&
          event.method === 'Network.responseReceived' &&
          event.params.type === 'Document'
      )?.params.response.status
      const { result } = await send(
        'Runtime.evaluate',
        {
          expression:
            "JSON.stringify({ title: document.title, text: document.body?.innerText ?? '' })",
          returnByValue: true
        },
        sessionId
      )
      const { title, text } = JSON.parse(result.value)
      const png = screenshot
        ? Buffer.from(
            (await send('Page.captureScreenshot', { format: 'png' }, sessionId))
              .data,
            'base64'
          )
        : null
      const blocked = BLOCKED.test(`${title} ${text.slice(0, SNIFF_CHARS)}`)
      const reason =
        (status >= HTTP.BAD_REQUEST && `HTTP ${status}`) ||
        (blocked && 'blocked') ||
        (text.length < THIN_CHARS && 'thin') ||
        null
      return {
        ok: !reason,
        reason,
        status,
        load,
        title,
        chars: text.length,
        png,
        ...(keep_text && { text })
      }
    } catch (error) {
      return { ok: false, reason: error.message, load: seconds(start) }
    } finally {
      if (targetId)
        await send('Target.closeTarget', { targetId }).catch(() => {})
      socket.close()
    }
  }

  /** Stop every Firecracker, drop the TAP, keep only the serial log. */
  async stop() {
    await Promise.all(this.pids.map(pid => firecracker.terminate(pid)))
    syscalls.delete_tap(this.tap)
    for (const file of [
      'rootfs.ext4',
      'chrome.mem',
      'chrome.state',
      'api.sock'
    ])
      rm_sync(join(this.work, file), { force: true })
  }
}
