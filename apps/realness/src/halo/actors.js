import {
  createHash as create_hash,
  randomBytes as random_bytes,
  randomUUID as random_uuid
} from 'node:crypto'
import { writeFileDurable as write_file_durable } from './durable.js'
import {
  createReadStream as create_read_stream,
  existsSync as exists_sync,
  lstatSync as lstat_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  rmSync as rm_sync,
  statSync as stat_sync,
  unlinkSync as unlink_sync,
  writeFileSync as write_file_sync,
  appendFileSync as append_file_sync
} from 'node:fs'
import { arch } from 'node:os'
import { performance } from 'node:perf_hooks'
import { basename, join } from 'node:path'
import {
  BadRequest,
  Busy,
  Full,
  HaloError,
  NotFound,
  Parking,
  VsockError
} from './errors.js'
import * as firecracker from './firecracker.js'
import * as host from './syscalls.js'
import { logger } from './log.js'
import * as vsock from './vsock.js'
import { next_step } from './lifecycle.js'
import { wait_for_door } from './door.js'
import { create_startup_trace } from '#root/src/harness/startup.js'
/** @typedef {import('#root/src/harness/startup.js').StartupTrace} StartupTrace */
import {
  GIB,
  ID_BYTES,
  KIB,
  MIB,
  MS_PER_MINUTE,
  MS_PER_SECOND
} from '#root/lib/units.js'
import { stripVTControlCharacters as strip_vt } from 'node:util'
/* eslint-disable no-await-in-loop -- lifecycle steps run in order; warming waits for each echo */

const WARM_TAIL = 600
const LOG_TAIL = 4000
const ERROR_TAIL = 200
const FIRST_ECHO_MS = 3000
const DIGEST_SHOWN = 12

const LOG = logger('actors')
const RECOVER_SECONDS = 300

const DISK = 'rootfs.ext4'
/** Where a handover log waits for the actor's next turn. */
const HANDS_OVER = '/realness/.handover/log.json'
const STATE = 'state'
const MEM = 'mem'
const ACTOR_INIT = '/usr/local/bin/realness-actor-init'
export const PTY_PORT = 53
const PI_OPENER = Buffer.from('exec realness\r')
const PI_PROMPT = 'inkling'
const PI_WARM_SECONDS = 300
const FINGERPRINT_SCHEMA = 1
const CHEAP_FIELDS = [
  'schema',
  'arch',
  'kernel',
  'firecracker',
  'template_size',
  'template_mtime_ns',
  'vcpu_count',
  'mem_size_mib'
]
/** Measured in hs-mem: a 512 MiB guest was killed by a 384 MiB workload; 768 MiB held every stage. */
export const ACTOR_MIB = 768
const ARTIFACT_PATHS = ['realness']
const TRACES = 'traces'
const EXPORTS = 'exports'
const PUBLISHED = 'published'
const VERSIONS = 'published-versions'
const NON_ACTOR_DIRS = new Set([
  'seed',
  'apps',
  TRACES,
  EXPORTS,
  PUBLISHED,
  VERSIONS
])
const ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/

const sleep = ms =>
  new Promise(done => {
    setTimeout(done, ms)
  })
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, '+00:00')
/** MemAvailable in bytes, or null where /proc/meminfo cannot be read. */
const read_mem_available = () => {
  try {
    const match = /^MemAvailable:\s+(\d+) kB$/m.exec(
      read_file_sync('/proc/meminfo', 'utf8')
    )
    return match ? Number(match[1]) * KIB : null
  } catch {
    return null
  }
}
const gib = bytes => (bytes / GIB).toFixed(2)
const mintId = () => `a-${random_bytes(ID_BYTES).toString('hex')}`
const writeJson = (path, value) =>
  write_file_durable(path, `${JSON.stringify(value, null, 2)}\n`)
const readJson = path => JSON.parse(read_file_sync(path, 'utf8'))
const unlink = path => rm_sync(path, { force: true })
const machine = () => ({ arm64: 'aarch64', x64: 'x86_64' })[arch()] ?? arch()

const sha256File = path =>
  new Promise((done, fail) => {
    const hash = create_hash('sha256')
    create_read_stream(path)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => done(hash.digest('hex')))
      .on('error', fail)
  })

/**
 * One actor record. `Object.assign` fills these, so they are declared here for
 * the type checker and the reader.
 * @typedef {object} ActorFields
 * @property {string} id
 * @property {StartupTrace | null} [startup]
 * @property {string} state
 * @property {string} created
 * @property {string} tap
 * @property {number} pid
 * @property {string} hostname
 * @property {string} machine_id
 * @property {string} boot_id
 * @property {string} dir
 * @property {string | null} owner
 * @property {string[] | null} [paths]
 * @property {string} last_activity
 * @property {string} synced_at
 */

export class Actor {
  /** @type {string} */
  id = ''
  /** @type {StartupTrace | null} */
  startup = null
  /** @type {string} */
  state
  /** @type {string} */
  created = ''
  /** @type {string} */
  tap = ''
  /** @type {number} */
  pid = 0
  /** @type {string} */
  hostname = ''
  /** @type {string} */
  machine_id = ''
  /** @type {string} */
  boot_id = ''
  /** @type {string} */
  dir = ''
  /** @type {string | null} */
  owner = null
  /** @type {string[] | null} */
  paths = null
  /** @type {string} */
  last_activity = ''
  /** @type {string} */
  synced_at = ''
  /** @type {string} */
  apiSock = ''
  /** @type {string} */
  vsockPath = ''

  /** @param {Partial<ActorFields>} fields */
  constructor(fields) {
    Object.assign(
      this,
      {
        machine_id: '',
        hostname: '',
        boot_id: '',
        state: 'running',
        owner: null,
        paths: null,
        last_activity: '',
        synced_at: ''
      },
      fields
    )
    this.apiSock = join(this.dir, 'api.sock')
    this.vsockPath = join(this.dir, 'vsock.sock')
  }

  toJSON() {
    const {
      id,
      state,
      created,
      tap,
      pid,
      hostname,
      machine_id,
      boot_id,
      dir,
      owner,
      paths,
      last_activity,
      synced_at
    } = this
    return {
      id,
      state,
      created,
      tap,
      pid,
      hostname,
      machine_id,
      boot_id,
      dir,
      owner,
      paths,
      last_activity,
      synced_at
    }
  }
}

/** One lock for everything that changes an actor; exec and reads stay outside it. */
class Mutex {
  /** @type {Promise<unknown>} */
  #tail = Promise.resolve()

  /**
   * Run `work` after everything queued before it.
   * @template T
   * @param {() => Promise<T> | T} work
   * @returns {Promise<T>}
   */
  run(work) {
    const result = this.#tail.then(work)
    this.#tail = result.catch(() => {})
    return result
  }
}

/**
 * Start Pi in the seed's terminal and wait until a typed key echoes, so every
 * clone opens on a ready Pi. Every key typed is erased so the editor starts
 * empty: a slow Pi gets more than one before the first echoes.
 */
const warmPi = async (uds, seconds = PI_WARM_SECONDS) => {
  const { socket, lines } = await vsock.connect(uds, PTY_PORT)
  const send = data =>
    socket.write(
      `${JSON.stringify({ op: 'data', data_b64: data.toString('base64') })}\n`
    )
  const started = Date.now()
  let opened = false
  let prompt = false
  let lastKey = 0
  let keys = 0
  let seen = ''
  let tail = ''
  try {
    socket.write(`${JSON.stringify({ op: 'resize', cols: 80, rows: 24 })}\n`)
    while (Date.now() - started < seconds * MS_PER_SECOND) {
      /** @type {Buffer | null} */
      let line = null
      try {
        line = await lines.read(1)
      } catch {}
      if (line === null && lines.closed)
        throw new VsockError("the seed's terminal closed while warming pi")
      if (line?.length) {
        const message = JSON.parse(line.toString('utf8'))
        if (message.op === 'exit') {
          const said = strip_vt(tail).trim().slice(-WARM_TAIL)
          throw new VsockError(
            `pi exited while warming: ${line}${said ? `\n${said}` : ''}`
          )
        }
        const chunk = Buffer.from(message.data_b64 ?? '', 'base64').toString(
          'latin1'
        )
        tail = (tail + chunk).slice(-LOG_TAIL)
        if (!opened) {
          if (chunk.includes('# ')) {
            send(PI_OPENER)
            opened = true
          }
        } else if (!prompt) {
          seen += chunk
          prompt = seen.includes(PI_PROMPT)
        } else if (
          lastKey &&
          chunk.includes('q') &&
          chunk.includes('\x1b[2K')
        ) {
          send(Buffer.from('\x7f'.repeat(keys)))
          await sleep(MS_PER_SECOND)
          LOG.info(
            `pi warm in the seed after ${((Date.now() - started) / MS_PER_SECOND).toFixed(1)}s`
          )
          return
        }
      }
      if (!opened && Date.now() - started > FIRST_ECHO_MS) {
        send(PI_OPENER)
        opened = true
      }
      if (prompt && Date.now() - lastKey > MS_PER_SECOND) {
        send(Buffer.from('q'))
        keys++
        lastKey = Date.now()
      }
    }
    throw new VsockError(`pi did not echo a key within ${seconds}s`)
  } finally {
    socket.destroy()
  }
}

/**
 * The host-side actor store. `Object.assign` fills the options, so they are
 * declared here for the type checker and the reader.
 * @typedef {object} ActorStoreOptions
 * @property {string} volume
 * @property {string} template
 * @property {string} kernel
 * @property {string} firecracker
 * @property {string} guestMac
 * @property {number} guestCid
 * @property {number} vsockPort
 * @property {number} vcpus
 * @property {number} mib
 * @property {string} tapPrefix
 * @property {string} seedTap
 * @property {number} bootTimeout
 * @property {number} apiTimeout
 * @property {number} memoryReserve bytes a create must leave free (hs-over)
 * @property {() => number | null} memAvailable free memory in bytes, null when unknown
 * @property {string | null} [syncUrl]
 * @property {{ publish: (owner: string, site: string, staging: string, source: string) => Promise<object>, versions: (owner: string, site: string) => Promise<object[]>, restore: (owner: string, site: string, version: string) => Promise<object>, remove: (owner: string, site: string) => Promise<object> } | null} [syncSites]
 */

export class ActorStore {
  /** @type {string} */
  volume
  /** @type {string} */
  template
  /** @type {string} */
  kernel
  /** @type {string} */
  firecracker
  /** @type {string} */
  guestMac
  /** @type {number} */
  guestCid
  /** @type {number} */
  vsockPort
  /** @type {number} */
  vcpus
  /** @type {number} */
  mib
  /** @type {string} */
  tapPrefix
  /** @type {string} */
  seedTap
  /** @type {number} */
  bootTimeout
  /** @type {number} */
  apiTimeout
  /** @type {number} */
  memoryReserve
  /** @type {() => number | null} */
  memAvailable
  /** @type {string | null} */
  syncUrl = null
  /** @type {{ publish: (owner: string, site: string, staging: string, source: string) => Promise<object>, versions: (owner: string, site: string) => Promise<object[]>, restore: (owner: string, site: string, version: string) => Promise<object>, remove: (owner: string, site: string) => Promise<object> } | null} */
  syncSites
  /** @type {string} */
  seedDir
  /** @type {string} */
  tracesDir
  /** @type {string} */
  exportsDir
  /** @type {string} */
  publishedDir
  /** @type {string} */
  versionsDir
  /** @type {string} */
  firecrackerVersion
  /** @type {Mutex} */
  lock
  /** @type {Map<string, Set<string>>} */
  busy = new Map()
  /** @type {Set<string>} */
  turned = new Set()
  /** hs-over: the last TAP taken reads as a full halo, not a halo failure. */
  #freeTap() {
    try {
      return host.freeTap(this.tapPrefix)
    } catch (error) {
      if (error instanceof HaloError && /no free TAP/.test(error.message))
        throw new Full(`halo full: ${error.message}`)
      throw error
    }
  }

  /** Refuses new starts while parking. */
  closed = false

  /** @param {Partial<ActorStoreOptions>} options */
  constructor(options) {
    Object.assign(this, {
      guestCid: 3,
      vsockPort: vsock.VSOCK_PORT,
      vcpus: 2,
      mib: ACTOR_MIB,
      tapPrefix: 'fc-tap',
      seedTap: 'fc-tap0',
      bootTimeout: 60,
      apiTimeout: 30,
      memoryReserve: 2 * GIB,
      memAvailable: read_mem_available,
      ...options
    })
    this.seedDir = join(this.volume, 'seed')
    this.tracesDir = join(this.volume, TRACES)
    this.exportsDir = join(this.volume, EXPORTS)
    this.publishedDir = join(this.volume, PUBLISHED)
    this.versionsDir = join(this.volume, VERSIONS)
    this.lock = new Mutex()
    this.busy = new Map()
    this.turned = new Set()
    this.firecrackerVersion = firecracker.version(this.firecracker)
    host.requireRoot('creating TAPs and Firecracker')
    host.requireMount(
      this.volume,
      'mount the actors volume (the dev stack script)'
    )
    if (!host.shortEnoughForUnix(join(this.volume, mintId(), 'vsock.sock')))
      throw new HaloError(
        `${this.volume} is too long for AF_UNIX socket paths (108 bytes); mount the actors volume somewhere shorter`
      )
  }

  reflinkWarning() {
    return host.reflinkWarning(this.volume)
  }

  cheapFingerprint() {
    const stat = stat_sync(this.template, { bigint: true })
    return {
      schema: FINGERPRINT_SCHEMA,
      arch: machine(),
      kernel: basename(this.kernel),
      firecracker: this.firecrackerVersion,
      template_size: Number(stat.size),
      template_mtime_ns: Number(stat.mtimeNs),
      vcpu_count: this.vcpus,
      mem_size_mib: this.mib
    }
  }

  /** Whether a seed exists and matches the build; a stale seed forks quietly, so say so. */
  seedStatus() {
    /** @type {{ built: boolean, matches: boolean, mismatches: string[], record: Record<string, number> | null }} */
    const status = {
      built: false,
      matches: false,
      mismatches: [],
      record: null
    }
    const recordPath = join(this.seedDir, 'seed.json')
    if (!exists_sync(recordPath) || !exists_sync(join(this.seedDir, STATE)))
      return status
    const record = readJson(recordPath)
    const current = this.cheapFingerprint()
    status.built = true
    status.record = record
    for (const key of CHEAP_FIELDS) {
      const same =
        key === 'template_mtime_ns'
          ? Math.abs(record[key] - current[key]) < MS_PER_SECOND
          : record[key] === current[key]
      if (!same)
        status.mismatches.push(`${key}: ${record[key]} != ${current[key]}`)
    }
    status.matches = status.mismatches.length === 0
    return status
  }

  async ensureSeed({ rebuild = false } = {}) {
    const status = this.seedStatus()
    if (status.matches && !rebuild) return status
    if (rebuild && this.liveActors().length)
      throw new Busy(
        'actors are running from this seed; destroy them before --rebuild'
      )
    await this.buildSeed(status)
    return this.seedStatus()
  }

  /** Boot the template once, warm Pi, snapshot, stop (f4, f6). */
  async buildSeed(status = this.seedStatus()) {
    const target = this.seedDir
    if (status.built)
      LOG.warn(
        `seed does not match the current build: ${status.mismatches.join('; ')}`
      )
    LOG.info(`building the seed from ${this.template}`)
    rm_sync(target, { recursive: true, force: true })
    mkdir_sync(target, { recursive: true })
    host.run(['cp', '--sparse=always', this.template, join(target, DISK)])
    if (!host.tapExists(this.seedTap))
      throw new HaloError(
        `no ${this.seedTap}: run 'sudo bash server/halo/scripts/net-up.sh' first`
      )

    const apiSock = join(target, 'api.sock')
    const uds = join(target, 'vsock.sock')
    unlink(apiSock)
    unlink(uds)
    LOG.info('booting the template')
    const child = firecracker.spawn(
      this.firecracker,
      target,
      apiSock,
      join(target, 'firecracker.log')
    )
    let identity
    try {
      await firecracker.waitForApiSocket(apiSock)
      const api = new firecracker.Api(apiSock, this.apiTimeout)
      await firecracker.boot(api, {
        kernel: this.kernel,
        disk: DISK,
        tap: this.seedTap,
        uds,
        mac: this.guestMac,
        cid: this.guestCid,
        vcpus: this.vcpus,
        mib: this.mib
      })
      await vsock.waitForAgent(uds, this.bootTimeout, this.vsockPort)
      await vsock.execInGuest(
        uds,
        [
          '/bin/sh',
          '-c',
          "logger -t realness-seed 'seed boot marker'; touch /tmp/realness-seed-marker; sync"
        ],
        { timeout: this.apiTimeout, port: this.vsockPort }
      )
      identity = await this.identity(uds)
      LOG.info(`seed is up: hostname ${identity.hostname}`)
      await warmPi(uds)
      LOG.info('pausing and snapshotting')
      await firecracker.pause(api)
      await firecracker.createSnapshot(
        api,
        join(target, STATE),
        join(target, MEM)
      )
    } finally {
      await firecracker.terminate(child.pid)
    }
    const record = {
      ...this.cheapFingerprint(),
      template_sha256: await sha256File(this.template),
      created: nowIso(),
      machine_id: identity.machine_id,
      boot_id: identity.boot_id
    }
    writeJson(join(target, 'seed.json'), record)
    LOG.info(`seed built: ${target}`)
    return record
  }

  seedFingerprint() {
    const record = this.seedStatus().record ?? {}
    return Object.fromEntries(
      [...CHEAP_FIELDS, 'template_sha256'].map(key => [
        key,
        record[key] ?? null
      ])
    )
  }

  /**
   * Queued and recovering creates hold their memory until create returns.
   * @param {string} owner
   * @param {{ paths?: string[] | null, startup?: object | null }} [options]
   * @returns {Promise<Actor>}
   */
  async create(owner, { paths = null, startup = null } = {}) {
    if (this.closed) throw new Parking('the halo is parking; try again')
    this.#claimMemory()
    try {
      const record = await this.lock.run(() =>
        this.#create(owner, { paths, startup })
      )
      await this.#recover(record, record.startup)
      return record
    } finally {
      this.#claimed -= this.mib * MIB
    }
  }

  #startup(id, progress = {}) {
    return create_startup_trace({
      id: progress.id ?? random_uuid(),
      started_at: progress.started_at,
      clock: () => performance.now(),
      report: fields => {
        this.trace(id, 'startup-stage', fields)
        progress.report?.({ ...fields, actor_id: id })
      }
    })
  }

  /** k1: a new actor pulls its owner's work back from sync before first use. */
  async #recover(record, startup) {
    if (!this.syncUrl) return
    const started = Date.now()
    try {
      const { code, out, err } = await startup.run(
        'restoring_files',
        async () => {
          if (!(await wait_for_door(record.vsockPath)))
            LOG.warn(`actor ${record.id} door not open before recovery`)
          const result = await vsock.execInGuest(
            record.vsockPath,
            ['/usr/local/bin/realness-recover', this.syncUrl ?? ''],
            { timeout: RECOVER_SECONDS, port: this.vsockPort }
          )
          await this.#flush(record)
          return result
        },
        { succeeded: result => result.code === 0 }
      )
      this.trace(record.id, 'recover', {
        exit_code: code,
        ms: Date.now() - started,
        out: out.toString().trim().slice(-ERROR_TAIL),
        err: err.toString().trim().slice(-ERROR_TAIL)
      })
      if (code !== 0)
        LOG.warn(
          `actor ${record.id} recovery exited ${code}: ${err.toString().trim().slice(-ERROR_TAIL)}`
        )
    } catch (error) {
      LOG.warn(`actor ${record.id} recovery failed: ${error.message}`)
    }
    await this.#startPi(record, startup)
  }

  /** o0: start the terminal's Pi as its own traced stage; a Pi already running is left alone. */
  async #startPi(record, startup) {
    try {
      const pi_started = performance.now()
      const { code, err } = await startup.run(
        'starting_pi',
        () =>
          vsock.execInGuest(record.vsockPath, [ACTOR_INIT, 'start-pi'], {
            timeout: this.bootTimeout,
            port: this.vsockPort
          }),
        { succeeded: result => result.code === 0 }
      )
      if (code !== 0)
        LOG.warn(
          `actor ${record.id} Pi start exited ${code}: ${err.toString().trim().slice(-ERROR_TAIL)}`
        )
      this.trace(record.id, 'pi-start', { ms: performance.now() - pi_started })
    } catch (error) {
      LOG.warn(`actor ${record.id} Pi start failed: ${error.message}`)
    }
  }

  /**
   * k1: before pausing, push the actor's work to sync as its owner; retire waits for this.
   * @returns {Promise<boolean>} whether the actor's files reached sync
   */
  async #final_sync(record) {
    if (!this.syncUrl) return true
    try {
      const argv = [
        'runuser',
        '-u',
        'realness',
        '--',
        'env',
        `SYNC_URL=${this.syncUrl}`,
        '/usr/local/bin/realness',
        'sync'
      ]
      const { code, err } = await vsock.execInGuest(record.vsockPath, argv, {
        timeout: RECOVER_SECONDS,
        port: this.vsockPort
      })
      if (code !== 0) {
        LOG.warn(
          `actor ${record.id} final sync exited ${code}: ${err.toString().trim().slice(-ERROR_TAIL)}`
        )
        return false
      }
      record.synced_at = nowIso()
      this.#write(record)
      this.trace(record.id, 'final-sync', {})
      return true
    } catch (error) {
      LOG.warn(`actor ${record.id} final sync failed: ${error.message}`)
      return false
    }
  }

  /**
   * @param {string} owner
   * @param {{ paths?: string[] | null, startup?: object | null }} [options]
   * @returns {Promise<Actor>}
   */
  /** Memory promised to creates still queued or starting; they have not touched it yet. */
  #claimed = 0

  /** hs-over: refuse before any disk or TAP when memory would run out. Unknown memory does not refuse. */
  #claimMemory() {
    const available = this.memAvailable()
    const need = this.memoryReserve + this.#claimed + this.mib * MIB
    if (available !== null && available < need)
      throw new Full(
        `halo full: ${gib(available)} GiB free, ${gib(need)} GiB needed for another actor`
      )
    this.#claimed += this.mib * MIB
  }

  /**
   * @param {string} owner
   * @param {{ paths?: string[] | null, startup?: object | null }} [options]
   * @returns {Promise<Actor>}
   */
  async #create(owner, { paths = null, startup: progress = null } = {}) {
    if (this.closed) throw new Parking('the halo is parking; try again')
    if (!/^\+[1-9]\d{6,14}$/.test(owner))
      throw new BadRequest('verified owner required')
    const started = performance.now()
    const id = mintId()
    const startup = this.#startup(id, progress ?? {})
    await startup.run('checking_seed', async () => {
      const seed = await this.ensureSeed()
      if (!seed.matches)
        throw new Busy(
          `seed does not match the current build: ${seed.mismatches.join('; ')}`
        )
    })
    const record = new Actor({
      id,
      startup,
      created: nowIso(),
      tap: '',
      pid: 0,
      dir: join(this.volume, id),
      owner,
      paths,
      last_activity: nowIso()
    })
    try {
      mkdir_sync(record.dir, { recursive: true })
      this.#reflinkSeedDisk(record.dir)
      record.tap = this.#freeTap()
      host.createTap(record.tap)
      const timings = await this.#start(
        record,
        join(this.seedDir, STATE),
        join(this.seedDir, MEM),
        startup
      )
      const init_started = performance.now()
      Object.assign(
        record,
        await startup.run('initializing_actor', () =>
          this.#initActor(record, { pi_after_recovery: Boolean(this.syncUrl) })
        )
      )
      const init_ms = performance.now() - init_started
      this.#write(record)
      this.trace(record.id, 'create', {
        hostname: record.hostname,
        machine_id: record.machine_id,
        tap: record.tap,
        pid: record.pid,
        ...timings,
        init_ms,
        ms: performance.now() - started
      })
    } catch (error) {
      LOG.warn(`create failed for ${id}, rolling back`)
      await this.#teardown(record)
      throw error
    }
    LOG.info(
      `actor ${record.id} running (tap ${record.tap}, pid ${record.pid})`
    )
    return record
  }

  #reflinkSeedDisk(dir) {
    const source = join(this.seedDir, DISK)
    try {
      host.run(['cp', '--reflink=always', source, join(dir, DISK)])
    } catch (error) {
      throw new HaloError(
        `reflink failed: ${error.message}\nactor disks are reflinks of ${source}, which needs xfs (or btrfs) at ${this.volume}`
      )
    }
  }

  /** Load a snapshot as this actor: its TAP, its vsock, and (from cwd) its disk. */
  async #start(record, state, mem, startup) {
    const started = performance.now()
    unlink(record.apiSock)
    unlink(record.vsockPath)
    let child
    try {
      await startup.run('starting_actor', async () => {
        child = firecracker.spawn(
          this.firecracker,
          record.dir,
          record.apiSock,
          join(record.dir, 'firecracker.log')
        )
        record.pid = child.pid
        await firecracker.waitForApiSocket(record.apiSock)
        const api = new firecracker.Api(record.apiSock, this.apiTimeout)
        await firecracker.loadSnapshot(
          api,
          state,
          mem,
          record.tap,
          record.vsockPath
        )
      })
      const vm_ms = performance.now() - started
      const agent_started = performance.now()
      await startup.run('waiting_guest', () =>
        vsock.waitForAgent(record.vsockPath, this.bootTimeout, this.vsockPort)
      )
      return { vm_ms, agent_ms: performance.now() - agent_started }
    } catch (error) {
      if (child) await firecracker.terminate(child.pid)
      throw error
    }
  }

  /** Cold tier: boot the actor's own disk; the seed's memory would see a stale /realness. */
  async #bootActor(record, startup) {
    const started = performance.now()
    unlink(record.apiSock)
    unlink(record.vsockPath)
    let child
    try {
      await startup.run('starting_actor', async () => {
        child = firecracker.spawn(
          this.firecracker,
          record.dir,
          record.apiSock,
          join(record.dir, 'firecracker.log')
        )
        record.pid = child.pid
        await firecracker.waitForApiSocket(record.apiSock)
        const api = new firecracker.Api(record.apiSock, this.apiTimeout)
        await firecracker.boot(api, {
          kernel: this.kernel,
          disk: DISK,
          tap: record.tap,
          uds: record.vsockPath,
          mac: this.guestMac,
          cid: this.guestCid,
          vcpus: this.vcpus,
          mib: this.mib
        })
      })
      const vm_ms = performance.now() - started
      const agent_started = performance.now()
      await startup.run('waiting_guest', () =>
        vsock.waitForAgent(record.vsockPath, this.bootTimeout, this.vsockPort)
      )
      return { vm_ms, agent_ms: performance.now() - agent_started }
    } catch (error) {
      if (child) await firecracker.terminate(child.pid)
      throw error
    }
  }

  /** Turn the resumed clone into this actor (f6): clock, identity, address. */
  async #initActor(record, { pi_after_recovery = false } = {}) {
    const argv = [
      ACTOR_INIT,
      record.id,
      String(Math.floor(Date.now() / MS_PER_SECOND)),
      `${host.tapGuest(record.tap)}/30`,
      ...(pi_after_recovery ? ['--after-recovery'] : [])
    ]
    const { code, out, err } = await vsock.execInGuest(record.vsockPath, argv, {
      timeout: this.bootTimeout,
      port: this.vsockPort
    })
    if (code !== 0)
      throw new VsockError(
        `actor-init on ${record.id} exited ${code}: ${err.toString().trim()}`
      )
    LOG.info(`actor ${record.id} initialized: ${out.toString().trim()}`)
    const { machine_id, hostname, boot_id } = await this.identity(
      record.vsockPath
    )
    return { machine_id, hostname, boot_id }
  }

  async identity(uds) {
    const output = await vsock.runOk(
      uds,
      [
        '/bin/sh',
        '-c',
        'printf "%s %s %s %s\\n" "$(cat /etc/machine-id)" "$(hostname)" "$(cat /proc/sys/kernel/random/boot_id)" "$(date +%s)"'
      ],
      { timeout: this.apiTimeout, port: this.vsockPort }
    )
    const [machine_id, hostname, boot_id, clock] = output.trim().split(/\s+/)
    return { machine_id, hostname, boot_id, clock: Number(clock) }
  }

  /**
   * Run argv in one actor; no shell, so nothing in argv is parsed. The guest
   * is flushed before answering: a hard stop after an exec returned must not
   * lose what it wrote (h3).
   */
  /**
   * @param {string} id
   * @param {string[]} argv
   * @param {{ cwd?: string | null, stdin?: Buffer, timeout?: number | null }} [options]
   */
  async exec(
    id,
    argv,
    { cwd = null, stdin = Buffer.alloc(0), timeout = null } = {}
  ) {
    if (
      !Array.isArray(argv) ||
      !argv.length ||
      !argv.every(item => typeof item === 'string' && item)
    )
      throw new BadRequest('argv must be a non-empty list of strings')

    if (cwd !== null && typeof cwd !== 'string')
      throw new BadRequest('cwd must be a string')
    const record = await this.ensureRunning(id)
    const started = Date.now()
    const work = `exec:${random_uuid()}`
    this.beginWork(id, work)
    try {
      const { code, out, err } = await vsock.execInGuest(
        record.vsockPath,
        argv,
        {
          cwd,
          stdin,
          timeout: timeout || this.apiTimeout,
          port: this.vsockPort
        }
      )
      await this.#flush(record)
      this.trace(record.id, 'exec', {
        argv,
        cwd,
        exit_code: code,
        ms: Date.now() - started,
        stdout_bytes: out.length,
        stderr_bytes: err.length
      })
      return {
        exit_code: code,
        stdout_b64: out.toString('base64'),
        stderr_b64: err.toString('base64')
      }
    } finally {
      this.endWork(id, work)
    }
  }

  /** Guest page cache to its disk. A memory snapshot keeps it; a crash or cold boot does not. */
  async #flush(record) {
    try {
      await vsock.runOk(record.vsockPath, ['/bin/sync'], {
        timeout: this.apiTimeout,
        port: this.vsockPort
      })
      return true
    } catch (error) {
      LOG.warn(`actor ${record.id} did not sync: ${error.message}`)
      return false
    }
  }

  /** Flush every running actor: bounds what a hard stop loses from terminal writes. */
  async flushAll() {
    await Promise.all(this.liveActors().map(record => this.#flush(record)))
  }

  ensureRunning(id, options = {}) {
    if (this.closed) throw new Parking('the halo is parking; try again')
    return this.reload(id, options)
  }

  /**
   * Sync every running actor, then stop it keeping its disk. Any busy actor
   * or failed sync stops the pass and reopens the halo; nothing is lost.
   * New starts are refused from the first step.
   * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
   */
  park() {
    this.closed = true
    return this.lock.run(async () => {
      for (const record of this.liveActors()) {
        if (this.isBusy(record.id)) return unpark(this, `${record.id} is busy`)
        if (!(await this.#final_sync(record)))
          return unpark(this, `${record.id} did not sync`)
        await this.#idle(record.id, 'disk')
      }
      if (this.busy.size) return unpark(this, 'work arrived while parking')
      return { ok: true }
    })
  }

  /** Serve again after a parking pass that could not finish. */
  reopen() {
    this.closed = false
  }

  /**
   * Hold an actor busy under one key, so the idle sweep and parking leave it
   * alone. The key's kind is the text before `:`; holding a key twice is one hold.
   */
  beginWork(id, key = 'work') {
    const held = this.busy.get(id) ?? new Set()
    held.add(key)
    this.busy.set(id, held)
  }

  /** Release one key; releasing a key not held does nothing. */
  endWork(id, key = 'work') {
    const held = this.busy.get(id)
    if (!held?.delete(key)) return
    if (!held.size) this.busy.delete(id)
    this.touch(id).catch(() => {})
  }

  isBusy(id) {
    return this.busy.has(id)
  }

  /** Busy actors and held work by kind: connection, turn, loop, exec, browser. */
  activity() {
    /** @type {Record<string, number>} */
    const kinds = {}
    for (const held of this.busy.values())
      for (const key of held) {
        const [kind] = key.split(':')
        kinds[kind] = (kinds[kind] ?? 0) + 1
      }
    return { actors: this.busy.size, kinds }
  }

  /** Record activity, writing at most once a minute. */
  touch(id) {
    return this.lock.run(() => {
      const record = this.get(id)
      const last = Date.parse(record.last_activity)
      if (Number.isFinite(last) && Date.now() - last < MS_PER_MINUTE)
        return record
      record.last_activity = nowIso()
      this.#write(record)
      return record
    })
  }

  /**
   * Step idle actors down: memory, disk, export, then delete after a verified
   * export. Only verified owners are retired (lifecycle.next_step).
   */
  /**
   * @param {object} [options]
   * @param {number} [options.now]
   * @param {((record: Actor, step: string) => Promise<void>) | null} [options.apply]
   */
  sweep({ now = Date.now(), apply = null } = {}) {
    return this.lock.run(async () => {
      const done = []
      for (const record of this.list()) {
        if (this.isBusy(record.id)) continue
        const step = next_step(record, now, { synced: Boolean(this.syncUrl) })
        if (!step) continue
        if (apply) await apply(record, step)
        else if (step === 'retire') await this.#destroy(record.id)
        else if (step === 'memory') {
          await this.#final_sync(record)
          await this.#idle(record.id, step)
        } else if (step === 'export') {
          await this.#export(record.id)
          if (!this.#exportVerified(record.id)) {
            LOG.warn(`actor ${record.id} exported but not verified; keeping it`)
            continue
          }
          await this.#destroy(record.id)
        } else await this.#idle(record.id, step)

        done.push({ id: record.id, step })
      }
      return done
    })
  }

  /** An export is safe to retire when its manifest and bundle agree. */
  #exportVerified(id) {
    const dir = join(this.exportsDir, id)
    if (!exists_sync(join(dir, 'manifest.json'))) return false
    const manifest = readJson(join(dir, 'manifest.json'))
    const artifacts = join(dir, manifest.artifacts?.path ?? 'artifacts.tar.gz')
    return (
      exists_sync(artifacts) &&
      stat_sync(artifacts).size === manifest.artifacts?.bytes
    )
  }

  /** `memory` snapshots the actor; `disk` keeps only the disk. Idempotent. */
  idle(id, tier = 'memory') {
    return this.lock.run(() => this.#idle(id, tier))
  }

  async #idle(id, tier) {
    if (tier !== 'memory' && tier !== 'disk')
      throw new BadRequest(
        `unknown idle tier '${tier}'; expected memory or disk`
      )
    const record = this.get(id)
    if (record.state === 'running') {
      const pid = firecracker.pidForApiSock(record.apiSock) ?? record.pid
      await this.#flush(record)
      const api = new firecracker.Api(record.apiSock, this.apiTimeout)
      await firecracker.pause(api)
      await firecracker.terminate(pid)
    }
    if (tier === 'disk') {
      unlink(join(record.dir, STATE))
      unlink(join(record.dir, MEM))
    }
    this.trace(id, 'idle', { tier })
    LOG.info(`actor ${id} idle (${tier} tier)`)
    return this.get(id)
  }

  /** A memory snapshot is a restore; without one the actor's own disk boots. */
  reload(id, { startup = null } = {}) {
    return this.lock.run(() => this.#reload(id, startup))
  }

  async #reload(id, progress = null) {
    const record = this.get(id)
    if (record.state === 'running') return record
    if (this.closed) throw new Parking('the halo is parking; try again')
    const started = performance.now()
    const startup = this.#startup(id, progress ?? {})
    let timings
    const state = join(record.dir, STATE)
    const mem = join(record.dir, MEM)
    const fromMemory = false
    const holder = this.list().find(
      other =>
        other.id !== id && other.state === 'running' && other.tap === record.tap
    )
    if (holder)
      throw new HaloError(`${record.tap} is held by running actor ${holder.id}`)
    if (host.ensureTap(record.tap))
      LOG.info(`rebuilt ${record.tap} for actor ${id}`)
    if (fromMemory) {
      LOG.info(`reloading actor ${id} from its memory snapshot`)
      timings = await this.#start(record, state, mem, startup)
    } else {
      LOG.info(`booting actor ${id} from its disk`)
      timings = await this.#bootActor(record, startup)
    }
    const init_started = performance.now()
    Object.assign(
      record,
      await startup.run('initializing_actor', () =>
        this.#initActor(record, { pi_after_recovery: true })
      )
    )
    const init_ms = performance.now() - init_started
    this.#write(record)
    this.trace(id, 'reload', {
      from_memory: fromMemory,
      machine_id: record.machine_id,
      hostname: record.hostname,
      ...timings,
      init_ms,
      ms: performance.now() - started
    })
    LOG.info(`actor ${id} is up, ${record.hostname}`)
    await this.#startPi(record, startup)
    return this.get(id)
  }

  destroy(id) {
    return this.lock.run(() => this.#destroy(id))
  }

  async #destroy(id) {
    const record = this.get(id)
    LOG.info(`destroying actor ${id}`)
    this.trace(id, 'destroy')
    await this.#teardown(record)
    return record
  }

  /** The process has to be gone before its disk is removed. */
  async #teardown(record) {
    await firecracker.terminate(
      firecracker.pidForApiSock(record.apiSock) ?? record.pid
    )
    if (record.tap) host.deleteTap(record.tap)
    rm_sync(record.dir, { recursive: true, force: true })
    rm_sync(join(this.publishedDir, record.id), {
      recursive: true,
      force: true
    })
    rm_sync(join(this.versionsDir, record.id), {
      recursive: true,
      force: true
    })
  }

  #tracePath(id) {
    return join(this.tracesDir, `${id}.jsonl`)
  }

  /** Best effort: a trace that cannot be written must not fail what it describes. */
  trace(id, event, fields = {}) {
    const line = Object.fromEntries(
      Object.entries({ ts: nowIso(), event, ...fields }).sort(([a], [b]) =>
        a < b ? -1 : 1
      )
    )
    try {
      mkdir_sync(this.tracesDir, { recursive: true })
      append_file_sync(this.#tracePath(id), `${JSON.stringify(line)}\n`)
    } catch (error) {
      LOG.warn(`could not trace ${id} ${event}: ${error.message}`)
    }
  }

  traceOf(id, limit) {
    const path = this.#tracePath(id)
    if (!exists_sync(path)) return []
    const events = read_file_sync(path, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
    return limit ? events.slice(-limit) : events
  }

  /**
   * m3: time from create to the first accepted turn, the moment user code runs.
   * Recorded once; a halo restart re-reads the trace rather than trusting memory.
   */
  firstTurn(id, now = Date.now()) {
    if (this.turned.has(id)) return null
    this.turned.add(id)
    if (this.traceOf(id).some(row => row.event === 'first-turn')) return null
    const created = Date.parse(this.get(id).created)
    const ms = Number.isFinite(created) ? now - created : null
    this.trace(id, 'first-turn', ms === null ? {} : { ms })
    return ms
  }

  /**
   * Copy a directory out of a running actor and serve it. The tree is
   * untrusted: only files, directories, and links survive, and the server
   * refuses any path that resolves outside it.
   */
  publish(id, tree = '/realness/site', site = id) {
    return this.lock.run(async () => {
      const target = join(this.publishedDir, id)
      const staging = join(this.publishedDir, `.${id}.part`)
      await this.copyOut(id, tree, staging)
      if (this.syncSites) {
        const source = join(this.publishedDir, `.${id}.source.part`)
        try {
          if (
            tree === '/realness/work/site' ||
            tree.startsWith('/realness/work/site/')
          )
            await this.copyOut(id, '/realness/work/site', source)
          const published = await this.syncSites.publish(
            this.ownerOf(id),
            site,
            staging,
            exists_sync(source) ? source : staging
          )
          this.trace(id, 'publish', { site, path: tree, ...published })
          return { id: site, path: tree, ...published }
        } finally {
          rm_sync(staging, { recursive: true, force: true })
          rm_sync(source, { recursive: true, force: true })
        }
      }
      const previous = this.saveSite(id)
      try {
        rename_sync(staging, target)
      } catch (error) {
        if (previous) {
          rename_sync(join(this.versionsDir, id, previous), target)
          unlink(join(this.versionsDir, id, `${previous}.json`))
        }
        throw error
      }
      const files = listFiles(target)
      const published = {
        id,
        path: tree,
        files: files.length,
        bytes: files.reduce((sum, file) => sum + stat_sync(file).size, 0),
        url: `/s/${id}/`
      }
      this.trace(id, 'publish', published)
      return published
    })
  }

  /** Move the live site into private version storage, if one exists. */
  saveSite(id) {
    const target = join(this.publishedDir, id)
    if (!exists_sync(target)) return null
    const version = random_bytes(ID_BYTES).toString('hex')
    const directory = join(this.versionsDir, id)
    mkdir_sync(directory, { recursive: true })
    rename_sync(target, join(directory, version))
    writeJson(join(directory, `${version}.json`), {
      id: version,
      saved: new Date().toISOString()
    })
    return version
  }

  siteVersions(id, site = id) {
    if (this.syncSites) return this.syncSites.versions(this.ownerOf(id), site)
    const directory = join(this.versionsDir, id)
    if (!exists_sync(directory)) return []
    return readdir_sync(directory)
      .filter(name => /^[0-9a-f]{12}\.json$/.test(name))
      .map(name => readJson(join(directory, name)))
      .sort((a, b) => b.saved.localeCompare(a.saved))
  }

  restoreSite(id, version, site = id) {
    return this.lock.run(() => {
      if (this.syncSites)
        return this.syncSites.restore(this.ownerOf(id), site, version)
      if (typeof version !== 'string' || !/^[0-9a-f]{12}$/.test(version))
        throw new BadRequest('invalid site version')
      const directory = join(this.versionsDir, id)
      const source = join(directory, version)
      if (!exists_sync(source)) throw new NotFound(version)
      const target = join(this.publishedDir, id)
      this.saveSite(id)
      rename_sync(source, target)
      unlink(join(directory, `${version}.json`))
      this.trace(id, 'restore-site', { version })
      return { url: `/s/${id}/` }
    })
  }

  unpublishSite(id, site = id) {
    return this.lock.run(() => {
      if (this.syncSites) return this.syncSites.remove(this.ownerOf(id), site)
      const version = this.saveSite(id)
      if (!version) throw new NotFound(id)
      this.trace(id, 'unpublish', { version })
      return { version }
    })
  }

  /**
   * Leave the tab's session log where the actor's next turn will find it. The
   * file is the whole IndexedDB export, so the actor imports it at the tail
   * rather than starting a new session.
   * @param {string} id
   * @param {object} log
   */
  async receiveLog(id, log) {
    await this.ensureRunning(id)
    const result = await this.exec(
      id,
      ['sh', '-c', `mkdir -p $(dirname ${HANDS_OVER}) && tee ${HANDS_OVER}`],
      {
        stdin: Buffer.from(JSON.stringify(log), 'utf8')
      }
    )
    if (result.exit_code !== 0)
      throw new BadRequest(
        `could not leave the session log: ${result.exit_code}`
      )
    return { written: true }
  }

  /** Copy an actor's directory into a fresh `dest`; only plain entries survive. */
  async copyOut(id, tree, dest) {
    if (
      typeof tree !== 'string' ||
      !tree.startsWith('/') ||
      tree.split('/').includes('..')
    )
      throw new BadRequest('path must be absolute, with no .. segments')

    const result = await this.exec(id, ['tar', '-czf', '-', '-C', tree, '.'])
    if (result.exit_code !== 0) {
      const detail = Buffer.from(result.stderr_b64, 'base64').toString().trim()
      throw new BadRequest(
        `nothing to copy at ${tree}: ${detail || 'tar failed'}`
      )
    }
    rm_sync(dest, { recursive: true, force: true })
    mkdir_sync(dest, { recursive: true })
    try {
      host.run(
        [
          'tar',
          '-xzf',
          '-',
          '-C',
          dest,
          '--no-same-owner',
          '--no-same-permissions'
        ],
        { input: Buffer.from(result.stdout_b64, 'base64') }
      )
      keepPlainEntries(dest)
    } catch (error) {
      rm_sync(dest, { recursive: true, force: true })
      throw error
    }
  }

  publishedSite(id) {
    if (!ID.test(id)) return null
    const root = join(this.publishedDir, id)
    return exists_sync(root) && stat_sync(root).isDirectory() ? root : null
  }

  exports() {
    if (!exists_sync(this.exportsDir)) return []
    return readdir_sync(this.exportsDir)
      .sort()
      .filter(name => exists_sync(join(this.exportsDir, name, 'manifest.json')))
      .map(name => readJson(join(this.exportsDir, name, 'manifest.json')))
      .sort((a, b) => (b.exported ?? '').localeCompare(a.exported ?? ''))
  }

  /** Write an actor out as a bundle; it is stopped first and left stopped. */
  export(id) {
    return this.lock.run(() => this.#export(id))
  }

  async #export(id) {
    let record = this.get(id)
    if (record.state === 'running') record = await this.#idle(id, 'disk')
    const disk = join(record.dir, DISK)
    if (!exists_sync(disk)) throw new Busy(`actor ${id} has no disk to export`)
    const target = join(this.exportsDir, id)
    const staging = join(this.exportsDir, `.${id}.part`)
    rm_sync(staging, { recursive: true, force: true })
    mkdir_sync(staging, { recursive: true })
    let manifest
    try {
      const artifacts = join(staging, 'artifacts.tar.gz')
      await host.mounted(disk, tree =>
        host.run(['tar', '-czf', artifacts, '-C', tree, ...ARTIFACT_PATHS])
      )
      const listed = host.run(['tar', '-tzf', artifacts]).output
      const tracePath = this.#tracePath(id)
      const traceText = exists_sync(tracePath)
        ? read_file_sync(tracePath, 'utf8')
        : ''
      write_file_sync(join(staging, 'trace.jsonl'), traceText)
      manifest = {
        schema: 1,
        id,
        exported: nowIso(),
        actor: {
          id: record.id,
          created: record.created,
          machine_id: record.machine_id,
          hostname: record.hostname,
          owner: record.owner
        },
        artifacts: {
          path: 'artifacts.tar.gz',
          bytes: stat_sync(artifacts).size,
          sha256: await sha256File(artifacts),
          entries: listed.split('\n').filter(Boolean).length,
          paths: ARTIFACT_PATHS
        },
        trace: {
          path: 'trace.jsonl',
          events: traceText.split('\n').filter(line => line.trim()).length,
          bytes: Buffer.byteLength(traceText)
        },
        seed: this.seedFingerprint()
      }
      writeJson(join(staging, 'manifest.json'), manifest)
      rm_sync(target, { recursive: true, force: true })
      rename_sync(staging, target)
    } catch (error) {
      rm_sync(staging, { recursive: true, force: true })
      throw error
    }
    this.trace(id, 'export', {
      export: target,
      artifacts_sha256: manifest.artifacts.sha256,
      bytes: manifest.artifacts.bytes
    })
    LOG.info(
      `actor ${id} exported to ${target} (${manifest.artifacts.bytes} bytes)`
    )
    return manifest
  }

  /**
   * Land a bundle on a fresh disk: the export's files, a new identity, the old
   * trace. Under the lock no other create runs, so one memory claim covers the
   * whole restore.
   */
  restore(exportId, owner, { start = true } = {}) {
    return this.lock.run(async () => {
      if (!ID.test(exportId)) throw new NotFound(`export ${exportId}`)
      const exportDir = join(this.exportsDir, exportId)
      if (!exists_sync(join(exportDir, 'manifest.json')))
        throw new NotFound(`export ${exportId}`)
      const manifest = readJson(join(exportDir, 'manifest.json'))
      if (!manifest.actor?.owner || manifest.actor.owner !== owner)
        throw new NotFound(`export ${exportId}`)
      const artifacts = join(exportDir, manifest.artifacts.path)
      const digest = await sha256File(artifacts)
      if (digest !== manifest.artifacts.sha256)
        throw new BadRequest(
          `export ${exportId} is corrupt: ${digest.slice(0, DIGEST_SHOWN)} != ${manifest.artifacts.sha256.slice(0, DIGEST_SHOWN)}`
        )

      this.#claimMemory()
      try {
        let record = await this.#create(owner)
        try {
          await this.#idle(record.id, 'disk')
          await host.mounted(join(record.dir, DISK), tree =>
            host.run(['tar', '-xzf', artifacts, '-C', tree, '--no-same-owner'])
          )
          const tracePath = this.#tracePath(record.id)
          const current = exists_sync(tracePath)
            ? read_file_sync(tracePath, 'utf8')
            : ''
          write_file_sync(
            tracePath,
            read_file_sync(join(exportDir, 'trace.jsonl'), 'utf8') + current
          )
          const seed = this.seedFingerprint()
          this.trace(record.id, 'restore', {
            source: exportId,
            artifacts_sha256: digest,
            seed,
            seed_of_export: manifest.seed ?? null,
            seed_matches: JSON.stringify(seed) === JSON.stringify(manifest.seed)
          })
          if (start) record = await this.#reload(record.id)
        } catch (error) {
          LOG.warn(`restore of ${exportId} failed, rolling back`)
          await this.#teardown(record)
          throw error
        }
        LOG.info(`actor ${record.id} restored from ${exportId}`)
        return record
      } finally {
        this.#claimed -= this.mib * MIB
      }
    })
  }

  #write(record) {
    const {
      id,
      created,
      tap,
      pid,
      machine_id,
      hostname,
      boot_id,
      owner,
      paths,
      last_activity
    } = record
    writeJson(join(record.dir, 'actor.json'), {
      id,
      created,
      tap,
      pid,
      machine_id,
      hostname,
      boot_id,
      owner,
      paths,
      last_activity
    })
  }

  /** State comes from disk, not the record: after a reboot a recorded pid is a stranger. */
  #read(dir) {
    const stored = readJson(join(dir, 'actor.json'))
    const record = new Actor({
      id: stored.id,
      created: stored.created ?? '',
      tap: stored.tap ?? '',
      pid: stored.pid ?? 0,
      dir,
      machine_id: stored.machine_id ?? '',
      hostname: stored.hostname ?? '',
      boot_id: stored.boot_id ?? '',
      owner: stored.owner ?? null,
      paths: stored.paths ?? null,
      last_activity: stored.last_activity ?? stored.created ?? ''
    })
    if (firecracker.pidForApiSock(record.apiSock)) record.state = 'running'
    else if (exists_sync(join(dir, STATE)) && exists_sync(join(dir, MEM)))
      record.state = 'idle'
    else record.state = 'stopped'
    return record
  }

  get(id) {
    if (typeof id !== 'string' || !ID.test(id) || NON_ACTOR_DIRS.has(id))
      throw new NotFound(String(id))
    const dir = join(this.volume, id)
    if (!exists_sync(join(dir, 'actor.json'))) throw new NotFound(id)
    return this.#read(dir)
  }

  /**
   * The owner of an actor that must have one, for a site or a pass.
   * @param {string} id
   * @returns {string}
   */
  ownerOf(id) {
    const { owner } = this.get(id)
    if (!owner) throw new NotFound(id)
    return owner
  }

  list() {
    const records = []
    for (const name of readdir_sync(this.volume).sort()) {
      const dir = join(this.volume, name)
      if (NON_ACTOR_DIRS.has(name) || !lstat_sync(dir).isDirectory()) continue
      if (exists_sync(join(dir, 'actor.json'))) records.push(this.#read(dir))
      else {
        LOG.warn(`incomplete actor directory: ${dir}`)
        records.push(
          new Actor({
            id: name,
            created: '',
            tap: '',
            pid: 0,
            dir,
            state: 'incomplete'
          })
        )
      }
    }
    return records
  }

  liveActors() {
    return this.list().filter(record => record.state === 'running')
  }
}

/** End a parking pass early: serve again, and say why. */
const unpark = (store, reason) => {
  store.reopen()
  return /** @type {const} */ ({ ok: false, reason })
}

/** Drop devices, fifos, and sockets from an untrusted tree. */
const keepPlainEntries = root => {
  for (const entry of readdir_sync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) keepPlainEntries(path)
    else if (!entry.isFile() && !entry.isSymbolicLink()) unlink_sync(path)
  }
}

const listFiles = root =>
  readdir_sync(root, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
