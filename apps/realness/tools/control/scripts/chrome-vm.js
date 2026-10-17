import {
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  statSync as stat_sync
} from 'node:fs'
import { join } from 'node:path'
import * as firecracker from '#root/src/halo/firecracker.js'
import * as host from '#root/src/halo/syscalls.js'

const NET = '172.18'
const PORT = 9222
const FC = '/opt/fc/firecracker'
const KERNEL = '/opt/fc/vmlinux-6.1.155'
const IMAGE = '/opt/fc/chrome.ext4'
const BLOCKED =
  /just a moment|attention required|verify you are human|access denied|are you a robot|captcha|enable javascript and cookies/i

const sleep = ms => new Promise(done => setTimeout(done, ms))
export const seconds = since =>
  Number(((performance.now() - since) / 1000).toFixed(2))
export const mib = bytes => Math.round(bytes / 1048576)

/** A process's resident memory, bytes. @param {number} pid */
export const rss = pid => {
  const match = /VmRSS:\s+(\d+)/.exec(
    read_file_sync(`/proc/${pid}/status`, 'utf8')
  )
  if (!match) throw new Error(`no VmRSS for pid ${pid}`)
  return Number(match[1]) * 1024
}

/** A process's user plus system CPU, seconds: what the halo paid for the VM. */
export const cpu = pid => {
  const stat = read_file_sync(`/proc/${pid}/stat`, 'utf8')
  const [utime, stime] = stat
    .slice(stat.lastIndexOf(') ') + 2)
    .split(' ')
    .slice(11, 13)
    .map(Number)
  return (utime + stime) / 100
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
  constructor({ work, mib = 1024, vcpus = 2, huge_pages }) {
    host.requireRoot('creating TAPs and Firecracker')
    mkdir_sync(work, { recursive: true })
    Object.assign(this, { work, mib, vcpus, huge_pages, pids: [] })
    this.tap = host.freeTap('fc-chrome')
    this.address = host.tapGuest(this.tap, NET)
    const index = /\d+$/.exec(this.tap)
    if (!index) throw new Error(`tap name ${this.tap} has no trailing number`)
    this.mac = `06:00:AC:12:${Number(index[0]).toString(16).padStart(2, '0').toUpperCase()}:02`
    this.state = join(work, 'chrome.state')
    this.mem = join(work, 'chrome.mem')
    host.createTap(this.tap, NET)
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
    const deadline = Date.now() + limit * 1000
    for (;;) {
      try {
        const reply = await fetch(
          `http://${this.address}:${PORT}/json/version`,
          { signal: AbortSignal.timeout(1000) }
        )
        if (reply.ok) return await reply.json()
      } catch {}
      if (Date.now() > deadline)
        throw new Error(
          `no DevTools on ${this.address}:${PORT} after ${limit}s`
        )
      await sleep(100)
    }
  }

  /** A cold boot from a fresh copy of the image, until DevTools answers. */
  async boot() {
    const disk = join(this.work, 'rootfs.ext4')
    host.run(['cp', '--reflink=auto', '--sparse=always', IMAGE, disk])
    this.spawn()
    await firecracker.waitForApiSocket(this.api_sock)
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
    return this.devtools(120)
  }

  /** Pause, write state and memory, stop this Firecracker. */
  async snapshot() {
    await firecracker.pause(this.api)
    await firecracker.createSnapshot(this.api, this.state, this.mem)
    await firecracker.terminate(this.pid)
    return { mem_mib: mib(stat_sync(this.mem).size) }
  }

  /** A fresh Firecracker resumes the snapshot on the same TAP, until DevTools answers. */
  async restore() {
    this.spawn()
    await firecracker.waitForApiSocket(this.api_sock)
    await firecracker.loadSnapshot(
      new firecracker.Api(this.api_sock),
      this.state,
      this.mem,
      this.tap
    )
    return this.devtools(30)
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
    { limit = 30_000, screenshot = true, keep_text = false } = {}
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
        message.error
          ? fail(new Error(message.error.message))
          : done(message.result)
      } else if (message.method) events.push(message)
    }
    const send = (method, params = {}, sessionId) =>
      new Promise((done, fail) => {
        const id = ++next
        const timer = setTimeout(() => {
          waiting.delete(id)
          fail(new Error(`${method}: no reply in 15s`))
        }, 15_000)
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
        { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
        sessionId
      )
      await send('Page.navigate', { url }, sessionId)
      const deadline = Date.now() + limit
      while (
        !events.some(
          event =>
            event.sessionId === sessionId &&
            event.method === 'Page.loadEventFired'
        )
      ) {
        if (Date.now() > deadline)
          return { ok: false, reason: 'timeout', load: seconds(start) }
        await sleep(20)
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
      const blocked = BLOCKED.test(`${title} ${text.slice(0, 2000)}`)
      const reason =
        status >= 400
          ? `HTTP ${status}`
          : blocked
            ? 'blocked'
            : text.length < 200
              ? 'thin'
              : null
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
    for (const pid of this.pids) await firecracker.terminate(pid)
    host.deleteTap(this.tap)
    for (const file of [
      'rootfs.ext4',
      'chrome.mem',
      'chrome.state',
      'api.sock'
    ])
      rm_sync(join(this.work, file), { force: true })
  }
}
