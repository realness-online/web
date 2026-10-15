import { randomBytes as random_bytes } from 'node:crypto'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { BadRequest, HostError, NotFound } from './errors.js'
import * as firecracker from './firecracker.js'
import * as host from './host.js'
import { APP_PORT, infer } from './infer.js'
import { logger } from './log.js'
import { ID_BYTES, KIB, MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- boot polling waits between tries; checks run one app at a time */

const CRASH_MINUTES = 10
const MAX_TAP_INDEX = 255
const HEX = 16
const MIN_DISK_MIB = 16
const DISK_GROWTH = 1.5
const TAIL_LINES = 20
const BOOT_POLL_MS = 250

const LOG = logger('apps')
const ROOT = 'rootfs.ext4'
const CODE = 'code.ext4'
const NET = '172.17'
const ID = /^app-[0-9a-f]{12}$/

export const CAPS = { vcpus: 1, mib: 96 }

/** Memory for an app: the store's override, else the cap. */
export const mibFor = (needs, override) => override ?? CAPS.mib

const MISSES = 3
const CRASHES = 5
const CRASH_WINDOW = CRASH_MINUTES * MS_PER_MINUTE

const sleep = ms =>
  new Promise(done => {
    setTimeout(done, ms)
  })
const mintId = () => `app-${random_bytes(ID_BYTES).toString('hex')}`

/** fc-app5 -> 06:00:AC:11:05:02; the guest reads 172.17.5.2 off its MAC. */
export const macFor = tap => {
  const index = Number(/(\d+)$/.exec(tap)?.[1])
  if (!(index >= 1 && index <= MAX_TAP_INDEX))
    throw new HostError(`no app index in TAP ${tap}`)
  return `06:00:AC:11:${index.toString(HEX).padStart(2, '0').toUpperCase()}:02`
}

/** The start command as realness-app-start reads it: one argument per line. */
export const argvText = start => {
  if (!start?.length || start.some(arg => !arg || /\n/.test(arg)))
    throw new BadRequest(`bad start command: ${JSON.stringify(start)}`)
  return `${start.join('\n')}\n`
}

/** A read-only ext4 of the files plus argv; everything readable by `app`, nothing writable. */
const buildCodeDisk = (files, disk, start, work) => {
  const stage = join(work, 'stage')
  rm_sync(stage, { recursive: true, force: true })
  mkdir_sync(stage)
  try {
    host.run(['cp', '-a', '--reflink=auto', `${files}/.`, join(stage, 'code')])
    write_file_sync(join(stage, 'argv'), argvText(start))
    host.run(['chown', '-R', '0:0', stage])
    host.run(['chmod', '-R', 'a+rX,go-w', stage])
    const kib = Number(host.run(['du', '-sk', stage]).output.split(/\s/)[0])
    host.run([
      'truncate',
      '-s',
      `${Math.max(MIN_DISK_MIB * KIB, Math.ceil(kib * DISK_GROWTH) + 8 * KIB)}K`,
      disk
    ])
    host.run(['mkfs.ext4', '-q', '-F', '-L', 'app-code', '-d', stage, disk])
  } finally {
    rm_sync(stage, { recursive: true, force: true })
  }
}

const portOpen = (address, port, ms = MS_PER_SECOND) =>
  new Promise(done => {
    const socket = connect({ host: address, port, timeout: ms })
    const finish = open => {
      socket.destroy()
      done(open)
    }
    socket.on('connect', () => finish(true))
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
  })

const tail = (path, lines = TAIL_LINES) =>
  exists_sync(path)
    ? read_file_sync(path, 'utf8')
        .trimEnd()
        .split('\n')
        .slice(-lines)
        .join('\n')
    : ''

/**
 * One app as saved in its app.json.
 * @typedef {object} AppRecord
 * @property {string} id
 * @property {string} kind
 * @property {string} [owner] absent when the in-guest tool starts an app
 * @property {string} address
 * @property {number} port
 * @property {string} tap
 * @property {number} pid
 * @property {number} vcpus
 * @property {number} mib
 * @property {string} [state] set to crashed when the sweep gives up
 * @property {string} created
 * @property {string} [booted]
 * @property {string | null} [runtime]
 * @property {string[] | null} [start]
 * @property {string} [reason]
 * @property {boolean} [public]
 * @property {string[]} [restarts] ISO times, newest last
 */

export class AppStore {
  /** @type {string} */
  image
  /** @type {string} */
  runtimes
  /** @type {string} */
  tapPrefix
  /** @type {number} */
  bootTimeout
  /** @type {number} */
  apiTimeout
  /** @type {number} */
  vcpus
  /** @type {string} */
  volume
  /** @type {string} */
  kernel
  /** @type {string} */
  firecracker
  /** @type {number} */
  mib
  /** @type {string} */
  dir
  /** @type {Map<string, Promise<unknown>>} */
  queues = new Map()
  /** @type {Map<string, number>} */
  misses = new Map()

  /** @param {object} options */
  constructor(options) {
    Object.assign(this, {
      image: '/opt/fc/app.ext4',
      runtimes: '/opt/fc/runtimes',
      tapPrefix: 'fc-app',
      bootTimeout: 60,
      apiTimeout: 30,
      vcpus: CAPS.vcpus,
      ...options
    })
    this.dir = join(this.volume, 'apps')
    host.requireRoot('creating TAPs and Firecracker')
  }

  path(id, ...rest) {
    if (!ID.test(id ?? '')) throw new NotFound(String(id))
    return join(this.dir, id, ...rest)
  }

  /** @returns {AppRecord} */
  record(id) {
    const file = this.path(id, 'app.json')
    if (!exists_sync(file)) throw new NotFound(id)
    return JSON.parse(read_file_sync(file, 'utf8'))
  }

  /** Private is the default; public lets anyone with the id reach the app. */
  setPublic(id, open) {
    return this.serial(id, () =>
      this.write({ ...this.record(id), public: open })
    )
  }

  /** Every stored record, oldest id first. */
  list() {
    if (!exists_sync(this.dir)) return []
    return readdir_sync(this.dir)
      .filter(name => ID.test(name) && exists_sync(this.path(name, 'app.json')))
      .sort()
      .map(id => this.record(id))
  }

  /** The record, plus whether its VM runs and its port answers. */
  async status(id) {
    const record = this.record(id)
    const running = firecracker.alive(
      firecracker.pidForApiSock(this.path(id, 'api.sock'))
    )
    return {
      ...record,
      running,
      answering: running && (await portOpen(record.address, record.port))
    }
  }

  /** `copy(dest)` fills a staging folder; start runs from it, then it goes. */
  /**
   * @param {(dest: string) => Promise<void>} copy
   * @param {{ owner: string, state?: string, actor?: string, path?: string, public?: boolean }} meta
   * @returns {Promise<AppRecord>}
   */
  async startFrom(copy, meta) {
    mkdir_sync(this.dir, { recursive: true })
    const stage = join(
      this.dir,
      `.stage-${random_bytes(ID_BYTES).toString('hex')}`
    )
    try {
      await copy(stage)
      return await this.start(stage, meta)
    } finally {
      rm_sync(stage, { recursive: true, force: true })
    }
  }

  /**
   * @param {AppRecord} record
   * @returns {AppRecord}
   */
  write(record) {
    write_file_sync(
      this.path(record.id, 'app.json'),
      `${JSON.stringify(record, null, 2)}\n`
    )
    return record
  }

  /** One operation per app at a time: the sweep and the API never race. */
  /**
   * @template T
   * @param {string} id
   * @param {() => Promise<T> | T} work
   * @returns {Promise<T>}
   */
  serial(id, work) {
    this.queues ??= new Map()
    const next = (this.queues.get(id) ?? Promise.resolve()).then(work, work)
    this.queues.set(
      id,
      next.catch(() => {})
    )
    return next
  }

  /** Infer, build, boot, and wait for the port. A site gets a record and no VM. */
  /**
   * @param {string} files a folder to inspect and run
   * @param {{ owner?: string, state?: string, actor?: string, path?: string, public?: boolean }} [meta] record fields from the caller
   * @returns {Promise<AppRecord>} a site gets id and kind only; no VM boots
   */
  async start(files, meta = {}) {
    const needs = infer(files)
    const id = mintId()
    if (needs.kind === 'site')
      return /** @type {AppRecord} */ ({ id, kind: 'site', ...meta })
    const runtime = needs.runtime
      ? join(this.runtimes, `${needs.runtime}.ext4`)
      : null
    if (runtime && !exists_sync(runtime))
      throw new HostError(`no runtime disk ${runtime}: run runtime-build.sh`)
    const dir = this.path(id)
    mkdir_sync(dir, { recursive: true })
    let tap = ''
    try {
      buildCodeDisk(files, join(dir, CODE), needs.start, dir)
      tap = host.freeTap(this.tapPrefix)
      host.createTap(tap, NET)
      this.write({
        id,
        ...meta,
        kind: needs.kind,
        runtime: needs.runtime,
        start: needs.start,
        tap,
        pid: 0,
        address: host.tapGuest(tap, NET),
        port: APP_PORT,
        vcpus: this.vcpus,
        mib: mibFor(needs, this.mib),
        created: new Date().toISOString()
      })
      return await this.serial(id, () => this.boot(id))
    } catch (error) {
      await firecracker.terminate(
        firecracker.pidForApiSock(join(dir, 'api.sock'))
      )
      if (tap) host.deleteTap(tap)
      rm_sync(dir, { recursive: true, force: true })
      throw error
    }
  }

  /**
   * A fresh boot from the record: a new copy of the image, the same code disk,
   * TAP, MAC, and address. Any VM still on the api socket goes first.
   */
  /** @returns {Promise<AppRecord>} */
  async boot(id) {
    const record = this.record(id)
    const dir = this.path(id)
    const apiSock = join(dir, 'api.sock')
    const log = join(dir, 'firecracker.log')
    await firecracker.terminate(firecracker.pidForApiSock(apiSock))
    rm_sync(apiSock, { force: true })
    if (!host.tapExists(record.tap)) host.createTap(record.tap, NET)
    host.run([
      'cp',
      '--reflink=auto',
      '--sparse=always',
      this.image,
      join(dir, ROOT)
    ])
    const runtime = record.runtime
      ? join(this.runtimes, `${record.runtime}.ext4`)
      : null
    const child = firecracker.spawn(this.firecracker, dir, apiSock, log)
    child.unref()
    await firecracker.waitForApiSocket(apiSock)
    await firecracker.boot(new firecracker.Api(apiSock, this.apiTimeout), {
      kernel: this.kernel,
      disk: join(dir, ROOT),
      tap: record.tap,
      mac: macFor(record.tap),
      vcpus: record.vcpus,
      mib: record.mib,
      readOnly: { code: join(dir, CODE), ...(runtime && { runtime }) }
    })
    const deadline = Date.now() + this.bootTimeout * MS_PER_SECOND
    while (!(await portOpen(record.address, record.port))) {
      if (!firecracker.alive(child.pid))
        throw new HostError(`app VM exited during boot:\n${tail(log)}`)
      if (Date.now() > deadline)
        throw new HostError(
          `nothing on ${record.address}:${record.port} after ${this.bootTimeout}s:\n${tail(log)}`
        )
      await sleep(BOOT_POLL_MS)
    }
    LOG.info(
      `app ${id} (${record.kind}) on ${record.address}:${record.port}, tap ${record.tap}`
    )
    if (!child.pid) throw new HostError(`app ${id} spawned with no pid`)
    return this.write({
      ...record,
      pid: child.pid,
      booted: new Date().toISOString()
    })
  }

  /**
   * u5: one pass over every app. A dead VM, or a port closed MISSES sweeps
   * running, gets a fresh boot. CRASHES restarts inside CRASH_WINDOW mark
   * the app `crashed` and stop it; its files stay for the owner to read.
   */
  async sweep(now = Date.now()) {
    this.misses ??= new Map()
    const done = []
    for (const { id, kind, state, booted } of this.list()) {
      if (kind === 'site' || state === 'crashed' || !booted) continue
      const step = await this.serial(id, () => this.check(id, now)).catch(
        error => `failed: ${error.message.split('\n')[0]}`
      )
      if (step) done.push({ id, step })
    }
    return done
  }

  async check(id, now) {
    if (!exists_sync(this.path(id, 'app.json'))) return null
    const record = this.record(id)
    const running = firecracker.alive(
      firecracker.pidForApiSock(this.path(id, 'api.sock'))
    )
    if (running && (await portOpen(record.address, record.port))) {
      this.misses.delete(id)
      return null
    }
    const misses = (this.misses.get(id) ?? 0) + 1
    this.misses.set(id, misses)
    if (running && misses < MISSES) return null
    const restarts = (record.restarts ?? []).filter(
      at => now - Date.parse(at) < CRASH_WINDOW
    )
    if (restarts.length >= CRASHES) {
      await firecracker.terminate(
        firecracker.pidForApiSock(this.path(id, 'api.sock'))
      )
      this.write({
        ...record,
        state: 'crashed',
        restarts,
        reason: tail(this.path(id, 'firecracker.log'), 5)
      })
      this.misses.delete(id)
      return 'crashed'
    }
    const newest = restarts.at(-1)
    const last = newest ? Date.parse(newest) : 0
    if (
      now - last <
      (restarts.length ? MS_PER_SECOND * 2 ** restarts.length : 0)
    )
      return null
    this.write({
      ...record,
      restarts: [...restarts, new Date(now).toISOString()]
    })
    this.misses.delete(id)
    await this.boot(id)
    return running ? 'restarted: port closed' : 'restarted: VM gone'
  }

  /** Stop the VM, give back its TAP, and delete its disks. */
  stop(id) {
    return this.serial(id, async () => {
      const { tap } = this.record(id)
      await firecracker.terminate(
        firecracker.pidForApiSock(this.path(id, 'api.sock'))
      )
      host.deleteTap(tap)
      rm_sync(this.path(id), { recursive: true, force: true })
    })
  }
}
