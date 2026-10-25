import {
  createHash as create_hash,
  randomBytes as random_bytes,
  randomUUID as random_uuid
} from 'node:crypto'
import { write_file_durable } from './durable.js'
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
import { pi_start_argv } from './pi-start.js'
import { basename, dirname, join } from 'node:path'
import { update_harness } from './harness-update.js'
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
import * as syscalls from './syscalls.js'
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
const PI_OPENER = Buffer.from('realness\r')
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
  'web-cache',
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
const now_iso = () => new Date().toISOString().replace(/\.\d+Z$/, '+00:00')
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
const mint_id = () => `a-${random_bytes(ID_BYTES).toString('hex')}`
const write_json = (path, value) =>
  write_file_durable(path, `${JSON.stringify(value, null, 2)}\n`)
const read_json = path => JSON.parse(read_file_sync(path, 'utf8'))
const unlink = path => rm_sync(path, { force: true })
const machine = () => ({ arm64: 'aarch64', x64: 'x86_64' })[arch()] ?? arch()

const sha256_file = path =>
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
  api_sock = ''
  /** @type {string} */
  vsock_path = ''

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
    this.api_sock = join(this.dir, 'api.sock')
    this.vsock_path = join(this.dir, 'vsock.sock')
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
const warm_pi = async (uds, seconds = PI_WARM_SECONDS) => {
  const { socket, lines } = await vsock.connect(uds, PTY_PORT)
  const send = data =>
    socket.write(
      `${JSON.stringify({ op: 'data', data_b64: data.toString('base64') })}\n`
    )
  const started = Date.now()
  let opened = false
  let prompt = false
  let last_key = 0
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
          last_key &&
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
      if (prompt && Date.now() - last_key > MS_PER_SECOND) {
        send(Buffer.from('q'))
        keys++
        last_key = Date.now()
      }
    }
    throw new VsockError(`pi did not echo a key within ${seconds}s`)
  } finally {
    socket.destroy()
  }
}

/**
 * The halo-side actor store. `Object.assign` fills the options, so they are
 * declared here for the type checker and the reader.
 * @typedef {object} ActorStoreOptions
 * @property {string} volume
 * @property {string} template
 * @property {string} kernel
 * @property {string} firecracker
 * @property {string} guest_mac
 * @property {number} guest_cid
 * @property {number} vsock_port
 * @property {number} vcpus
 * @property {number} mib
 * @property {string} tap_prefix
 * @property {string} seed_tap
 * @property {number} boot_timeout
 * @property {number} api_timeout
 * @property {number} memory_reserve bytes a create must leave free (hs-over)
 * @property {() => number | null} mem_available free memory in bytes, null when unknown
 * @property {string | null} [sync_url]
 * @property {{ publish: (owner: string, site: string, staging: string, source: string) => Promise<object>, versions: (owner: string, site: string) => Promise<object[]>, restore: (owner: string, site: string, version: string) => Promise<object>, remove: (owner: string, site: string) => Promise<object> } | null} [sync_sites]
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
  guest_mac
  /** @type {number} */
  guest_cid
  /** @type {number} */
  vsock_port
  /** @type {number} */
  vcpus
  /** @type {number} */
  mib
  /** @type {string} */
  tap_prefix
  /** @type {string} */
  seed_tap
  /** @type {number} */
  boot_timeout
  /** @type {number} */
  api_timeout
  /** @type {number} */
  memory_reserve
  /** @type {() => number | null} */
  mem_available
  /** @type {string | null} */
  sync_url = null
  /** @type {{ publish: (owner: string, site: string, staging: string, source: string) => Promise<object>, versions: (owner: string, site: string) => Promise<object[]>, restore: (owner: string, site: string, version: string) => Promise<object>, remove: (owner: string, site: string) => Promise<object> } | null} */
  sync_sites
  /** @type {string} */
  seed_dir
  /** @type {string} */
  traces_dir
  /** @type {string} */
  exports_dir
  /** @type {string} */
  published_dir
  /** @type {string} */
  versions_dir
  /** @type {string} */
  firecracker_version
  /** @type {Mutex} */
  lock
  /** @type {Map<string, Set<string>>} */
  busy = new Map()
  /** @type {Set<string>} */
  turned = new Set()
  /** hs-over: the last TAP taken reads as a full halo, not a halo failure. */
  #free_tap() {
    try {
      return syscalls.free_tap(this.tap_prefix)
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
      guest_cid: 3,
      vsock_port: vsock.VSOCK_PORT,
      vcpus: 2,
      mib: ACTOR_MIB,
      tap_prefix: 'fc-tap',
      seed_tap: 'fc-tap0',
      boot_timeout: 60,
      api_timeout: 30,
      memory_reserve: 2 * GIB,
      mem_available: read_mem_available,
      ...options
    })
    this.seed_dir = join(this.volume, 'seed')
    this.traces_dir = join(this.volume, TRACES)
    this.exports_dir = join(this.volume, EXPORTS)
    this.published_dir = join(this.volume, PUBLISHED)
    this.versions_dir = join(this.volume, VERSIONS)
    this.lock = new Mutex()
    /** Publishing only copies a tree out, so it waits on other publishes, never on a sync or boot. */
    this.publishing = new Mutex()
    this.busy = new Map()
    this.turned = new Set()
    this.firecracker_version = firecracker.version(this.firecracker)
    syscalls.require_root('creating TAPs and Firecracker')
    syscalls.require_mount(
      this.volume,
      'mount the actors volume (the dev stack script)'
    )
    if (
      !syscalls.short_enough_for_unix(
        join(this.volume, mint_id(), 'vsock.sock')
      )
    )
      throw new HaloError(
        `${this.volume} is too long for AF_UNIX socket paths (108 bytes); mount the actors volume somewhere shorter`
      )
  }

  reflink_warning() {
    return syscalls.reflink_warning(this.volume)
  }

  cheap_fingerprint() {
    const stat = stat_sync(this.template, { bigint: true })
    return {
      schema: FINGERPRINT_SCHEMA,
      arch: machine(),
      kernel: basename(this.kernel),
      firecracker: this.firecracker_version,
      template_size: Number(stat.size),
      template_mtime_ns: Number(stat.mtimeNs),
      vcpu_count: this.vcpus,
      mem_size_mib: this.mib
    }
  }

  /** Whether a seed exists and matches the build; a stale seed forks quietly, so say so. */
  seed_status() {
    /** @type {{ built: boolean, matches: boolean, mismatches: string[], record: Record<string, number> | null }} */
    const status = {
      built: false,
      matches: false,
      mismatches: [],
      record: null
    }
    const record_path = join(this.seed_dir, 'seed.json')
    if (!exists_sync(record_path) || !exists_sync(join(this.seed_dir, STATE)))
      return status
    const record = read_json(record_path)
    const current = this.cheap_fingerprint()
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

  async ensure_seed({ rebuild = false } = {}) {
    const status = this.seed_status()
    if (status.matches && !rebuild) return status
    if (rebuild && this.live_actors().length)
      throw new Busy(
        'actors are running from this seed; destroy them before --rebuild'
      )
    await this.build_seed(status)
    return this.seed_status()
  }

  /** Boot the template once, warm Pi, snapshot, stop (f4, f6). */
  async build_seed(status = this.seed_status()) {
    const target = this.seed_dir
    if (status.built)
      LOG.warn(
        `seed does not match the current build: ${status.mismatches.join('; ')}`
      )
    LOG.info(`building the seed from ${this.template}`)
    rm_sync(target, { recursive: true, force: true })
    mkdir_sync(target, { recursive: true })
    syscalls.run(['cp', '--sparse=always', this.template, join(target, DISK)])
    if (!syscalls.tap_exists(this.seed_tap))
      throw new HaloError(
        `no ${this.seed_tap}: run 'sudo bash server/halo/scripts/net-up.sh' first`
      )

    const api_sock = join(target, 'api.sock')
    const uds = join(target, 'vsock.sock')
    unlink(api_sock)
    unlink(uds)
    LOG.info('booting the template')
    const child = firecracker.spawn(
      this.firecracker,
      target,
      api_sock,
      join(target, 'firecracker.log')
    )
    let identity
    try {
      await firecracker.wait_for_api_socket(api_sock)
      const api = new firecracker.Api(api_sock, this.api_timeout)
      await firecracker.boot(api, {
        kernel: this.kernel,
        disk: DISK,
        tap: this.seed_tap,
        uds,
        mac: this.guest_mac,
        cid: this.guest_cid,
        vcpus: this.vcpus,
        mib: this.mib
      })
      await vsock.wait_for_agent(uds, this.boot_timeout, this.vsock_port)
      await vsock.exec_in_guest(
        uds,
        [
          '/bin/sh',
          '-c',
          "logger -t realness-seed 'seed boot marker'; touch /tmp/realness-seed-marker; sync"
        ],
        { timeout: this.api_timeout, port: this.vsock_port }
      )
      identity = await this.identity(uds)
      LOG.info(`seed is up: hostname ${identity.hostname}`)
      await warm_pi(uds)
      LOG.info('pausing and snapshotting')
      await firecracker.pause(api)
      await firecracker.create_snapshot(
        api,
        join(target, STATE),
        join(target, MEM)
      )
    } finally {
      await firecracker.terminate(child.pid)
    }
    const record = {
      ...this.cheap_fingerprint(),
      template_sha256: await sha256_file(this.template),
      created: now_iso(),
      machine_id: identity.machine_id,
      boot_id: identity.boot_id
    }
    write_json(join(target, 'seed.json'), record)
    LOG.info(`seed built: ${target}`)
    return record
  }

  seed_fingerprint() {
    const record = this.seed_status().record ?? {}
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
    this.#claim_memory()
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
    if (!this.sync_url) return
    const started = Date.now()
    try {
      const { code, out, err } = await startup.run(
        'restoring_files',
        async () => {
          if (!(await wait_for_door(record.vsock_path)))
            LOG.warn(`actor ${record.id} door not open before recovery`)
          const result = await vsock.exec_in_guest(
            record.vsock_path,
            ['/usr/local/bin/realness-recover', this.sync_url ?? ''],
            { timeout: RECOVER_SECONDS, port: this.vsock_port }
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
    await this.#start_pi(record, startup)
  }

  /** o0: start the terminal's Pi as its own traced stage; a Pi already running is left alone. */
  async #start_pi(record, startup) {
    try {
      const pi_started = performance.now()
      const { code, err } = await startup.run(
        'starting_pi',
        () =>
          vsock.exec_in_guest(record.vsock_path, pi_start_argv(ACTOR_INIT), {
            timeout: this.boot_timeout,
            port: this.vsock_port
          }),
        { succeeded: result => result.code === 0 }
      )
      if (code !== 0)
        throw new HaloError(
          `Pi did not start: ${err.toString().trim().slice(-ERROR_TAIL) || `exit ${code}`}`
        )
      this.trace(record.id, 'pi-start', { ms: performance.now() - pi_started })
    } catch (error) {
      LOG.warn(`actor ${record.id} Pi start failed: ${error.message}`)
      throw error
    }
  }

  /**
   * k1: before pausing, push the actor's work to sync as its owner; retire waits for this.
   * @returns {Promise<boolean>} whether the actor's files reached sync
   */
  async #final_sync(record) {
    if (!this.sync_url) return true
    try {
      const argv = [
        'runuser',
        '-u',
        'realness',
        '--',
        '/usr/local/bin/realness',
        'sync',
        '--sync',
        this.sync_url
      ]
      const { code, err } = await vsock.exec_in_guest(record.vsock_path, argv, {
        timeout: RECOVER_SECONDS,
        port: this.vsock_port
      })
      if (code !== 0) {
        LOG.warn(
          `actor ${record.id} final sync exited ${code}: ${err.toString().trim().slice(-ERROR_TAIL)}`
        )
        return false
      }
      record.synced_at = now_iso()
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
  #claim_memory() {
    const available = this.mem_available()
    const need = this.memory_reserve + this.#claimed + this.mib * MIB
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
    const id = mint_id()
    const startup = this.#startup(id, progress ?? {})
    await startup.run('checking_seed', async () => {
      const seed = await this.ensure_seed()
      if (!seed.matches)
        throw new Busy(
          `seed does not match the current build: ${seed.mismatches.join('; ')}`
        )
    })
    const record = new Actor({
      id,
      startup,
      created: now_iso(),
      tap: '',
      pid: 0,
      dir: join(this.volume, id),
      owner,
      paths,
      last_activity: now_iso()
    })
    try {
      mkdir_sync(record.dir, { recursive: true })
      this.#reflink_seed_disk(record.dir)
      record.tap = this.#free_tap()
      syscalls.create_tap(record.tap)
      const timings = await this.#start(
        record,
        join(this.seed_dir, STATE),
        join(this.seed_dir, MEM),
        startup
      )
      const init_started = performance.now()
      Object.assign(
        record,
        await startup.run('initializing_actor', () =>
          this.#init_actor(record, {
            pi_after_recovery: Boolean(this.sync_url)
          })
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

  #reflink_seed_disk(dir) {
    const source = join(this.seed_dir, DISK)
    try {
      syscalls.run(['cp', '--reflink=always', source, join(dir, DISK)])
    } catch (error) {
      throw new HaloError(
        `reflink failed: ${error.message}\nactor disks are reflinks of ${source}, which needs xfs (or btrfs) at ${this.volume}`
      )
    }
  }

  /** Load a snapshot as this actor: its TAP, its vsock, and (from cwd) its disk. */
  async #start(record, state, mem, startup) {
    const started = performance.now()
    unlink(record.api_sock)
    unlink(record.vsock_path)
    let child
    try {
      await startup.run('starting_actor', async () => {
        child = firecracker.spawn(
          this.firecracker,
          record.dir,
          record.api_sock,
          join(record.dir, 'firecracker.log')
        )
        record.pid = child.pid
        await firecracker.wait_for_api_socket(record.api_sock)
        const api = new firecracker.Api(record.api_sock, this.api_timeout)
        await firecracker.load_snapshot(
          api,
          state,
          mem,
          record.tap,
          record.vsock_path
        )
      })
      const vm_ms = performance.now() - started
      const agent_started = performance.now()
      await startup.run('waiting_guest', () =>
        vsock.wait_for_agent(
          record.vsock_path,
          this.boot_timeout,
          this.vsock_port
        )
      )
      return { vm_ms, agent_ms: performance.now() - agent_started }
    } catch (error) {
      if (child) await firecracker.terminate(child.pid)
      throw error
    }
  }

  /** Cold tier: boot the actor's own disk; the seed's memory would see a stale /realness. */
  async #boot_actor(record, startup) {
    const started = performance.now()
    unlink(record.api_sock)
    unlink(record.vsock_path)
    let child
    try {
      await startup.run('starting_actor', async () => {
        child = firecracker.spawn(
          this.firecracker,
          record.dir,
          record.api_sock,
          join(record.dir, 'firecracker.log')
        )
        record.pid = child.pid
        await firecracker.wait_for_api_socket(record.api_sock)
        const api = new firecracker.Api(record.api_sock, this.api_timeout)
        await firecracker.boot(api, {
          kernel: this.kernel,
          disk: DISK,
          tap: record.tap,
          uds: record.vsock_path,
          mac: this.guest_mac,
          cid: this.guest_cid,
          vcpus: this.vcpus,
          mib: this.mib
        })
      })
      const vm_ms = performance.now() - started
      const agent_started = performance.now()
      await startup.run('waiting_guest', () =>
        vsock.wait_for_agent(
          record.vsock_path,
          this.boot_timeout,
          this.vsock_port
        )
      )
      return { vm_ms, agent_ms: performance.now() - agent_started }
    } catch (error) {
      if (child) await firecracker.terminate(child.pid)
      throw error
    }
  }

  /** Turn the resumed clone into this actor (f6): clock, identity, address. */
  async #init_actor(record, { pi_after_recovery = false } = {}) {
    const argv = [
      ACTOR_INIT,
      record.id,
      String(Math.floor(Date.now() / MS_PER_SECOND)),
      `${syscalls.tap_guest(record.tap)}/30`,
      ...(pi_after_recovery ? ['--after-recovery'] : [])
    ]
    const { code, out, err } = await vsock.exec_in_guest(
      record.vsock_path,
      argv,
      {
        timeout: this.boot_timeout,
        port: this.vsock_port
      }
    )
    if (code !== 0)
      throw new VsockError(
        `actor-init on ${record.id} exited ${code}: ${err.toString().trim()}`
      )
    LOG.info(`actor ${record.id} initialized: ${out.toString().trim()}`)
    const { machine_id, hostname, boot_id } = await this.identity(
      record.vsock_path
    )
    return { machine_id, hostname, boot_id }
  }

  async identity(uds) {
    const output = await vsock.run_ok(
      uds,
      [
        '/bin/sh',
        '-c',
        'printf "%s %s %s %s\\n" "$(cat /etc/machine-id)" "$(hostname)" "$(cat /proc/sys/kernel/random/boot_id)" "$(date +%s)"'
      ],
      { timeout: this.api_timeout, port: this.vsock_port }
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
    const record = await this.ensure_running(id)
    const started = Date.now()
    const work = `exec:${random_uuid()}`
    this.begin_work(id, work)
    try {
      const { code, out, err } = await vsock.exec_in_guest(
        record.vsock_path,
        argv,
        {
          cwd,
          stdin,
          timeout: timeout || this.api_timeout,
          port: this.vsock_port
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
      this.end_work(id, work)
    }
  }

  /**
   * Run argv in one actor and report output as it arrives. A cancelled call
   * stops the command in the guest; the work slot closes either way.
   * @param {string} id
   * @param {string[]} argv
   * @param {object} [options]
   * @param {string | null} [options.cwd]
   * @param {Buffer} [options.stdin]
   * @param {number | null} [options.timeout]
   * @param {AbortSignal} [options.signal]
   * @param {(chunk: { stream: 'stdout' | 'stderr', data: Buffer }) => void} [options.on_output]
   * @param {Record<string, string>} [options.env]
   * @param {boolean} [options.inherit_env]
   * @param {{ afterBytes: number, afterLines: number }} [options.spill]
   * @returns {Promise<{ exit_code: number, stdout_bytes: number, stderr_bytes: number, error?: string, spill_path?: string }>}
   */
  async exec_stream(
    id,
    argv,
    {
      cwd = null,
      stdin = Buffer.alloc(0),
      timeout = null,
      signal = undefined,
      on_output = () => {},
      env = undefined,
      inherit_env = undefined,
      spill = undefined
    } = {}
  ) {
    if (
      !Array.isArray(argv) ||
      !argv.length ||
      !argv[0] ||
      !argv.every(item => typeof item === 'string' && !item.includes('\0'))
    )
      throw new BadRequest(
        'argv must start with a program and contain only strings'
      )
    if (cwd !== null && typeof cwd !== 'string')
      throw new BadRequest('cwd must be a string')
    const record = await this.ensure_running(id)
    const started = Date.now()
    const work = `exec:${random_uuid()}`
    let stdout_bytes = 0
    let stderr_bytes = 0
    this.begin_work(id, work)
    try {
      const { code, error, spill_path } = await vsock.exec_in_guest_stream(
        record.vsock_path,
        argv,
        {
          cwd,
          stdin,
          timeout: timeout ?? this.api_timeout,
          env,
          inherit_env,
          spill,
          port: this.vsock_port,
          signal,
          on_output: chunk => {
            if (chunk.stream === 'stdout') stdout_bytes += chunk.data.length
            else stderr_bytes += chunk.data.length
            on_output(chunk)
          }
        }
      )
      await this.#flush(record)
      this.trace(record.id, 'exec', {
        argv,
        cwd,
        exit_code: code,
        ms: Date.now() - started,
        stdout_bytes,
        stderr_bytes,
        streamed: true
      })
      return {
        exit_code: code,
        stdout_bytes,
        stderr_bytes,
        ...(error ? { error } : {}),
        ...(spill_path ? { spill_path } : {})
      }
    } finally {
      this.end_work(id, work)
    }
  }

  /** Guest page cache to its disk. A memory snapshot keeps it; a crash or cold boot does not. */
  async #flush(record) {
    try {
      await vsock.run_ok(record.vsock_path, ['/bin/sync'], {
        timeout: this.api_timeout,
        port: this.vsock_port
      })
      return true
    } catch (error) {
      LOG.warn(`actor ${record.id} did not sync: ${error.message}`)
      return false
    }
  }

  /** Flush every running actor: bounds what a hard stop loses from terminal writes. */
  async flush_all() {
    await Promise.all(this.live_actors().map(record => this.#flush(record)))
  }

  ensure_running(id, options = {}) {
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
      for (const record of this.live_actors()) {
        if (this.is_busy(record.id)) return unpark(this, `${record.id} is busy`)
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
  begin_work(id, key = 'work') {
    const held = this.busy.get(id) ?? new Set()
    held.add(key)
    this.busy.set(id, held)
  }

  /** Release one key; releasing a key not held does nothing. */
  end_work(id, key = 'work') {
    const held = this.busy.get(id)
    if (!held?.delete(key)) return
    if (!held.size) this.busy.delete(id)
    this.touch(id).catch(() => {})
  }

  is_busy(id) {
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
      record.last_activity = now_iso()
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
        if (this.is_busy(record.id)) continue
        const step = next_step(record, now, { synced: Boolean(this.sync_url) })
        if (!step) continue
        if (apply) await apply(record, step)
        else if (step === 'retire') await this.#destroy(record.id)
        else if (step === 'memory') {
          await this.#final_sync(record)
          await this.#idle(record.id, step)
        } else if (step === 'export') {
          await this.#export(record.id)
          if (!this.#export_verified(record.id)) {
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
  #export_verified(id) {
    const dir = join(this.exports_dir, id)
    if (!exists_sync(join(dir, 'manifest.json'))) return false
    const manifest = read_json(join(dir, 'manifest.json'))
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
      const pid = firecracker.pid_for_api_sock(record.api_sock) ?? record.pid
      await this.#flush(record)
      const api = new firecracker.Api(record.api_sock, this.api_timeout)
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

  /**
   * A stopped actor's harness follows the current template's release before
   * its disk boots. Files the person changed stay; a failure leaves the old
   * harness and the boot goes on.
   * @param {{ id: string, dir: string }} record
   */
  async #update_harness(record) {
    if (!this.template) return
    const release = join(dirname(this.template), 'template.inputs')
    const applied = join(record.dir, 'actor.inputs')
    const read = path =>
      exists_sync(path) ? read_file_sync(path, 'utf8').trim() : null
    const wanted = read(release)
    if (!wanted || read(applied) === wanted) return
    try {
      const { updated, removed, kept } = await syscalls.mounted(
        this.template,
        fresh =>
          syscalls.mounted(join(record.dir, DISK), actor =>
            update_harness({ fresh, actor })
          ),
        { readonly: true }
      )
      write_file_sync(applied, `${wanted}\n`)
      LOG.info(
        `actor ${record.id} harness updated: ${updated.length} changed, ${removed.length} removed, ${kept.length} kept as the person left them`
      )
    } catch (error) {
      LOG.warn(`actor ${record.id} harness not updated: ${error.message}`)
    }
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
    const from_memory = false
    const holder = this.list().find(
      other =>
        other.id !== id && other.state === 'running' && other.tap === record.tap
    )
    if (holder)
      throw new HaloError(`${record.tap} is held by running actor ${holder.id}`)
    if (syscalls.ensure_tap(record.tap))
      LOG.info(`rebuilt ${record.tap} for actor ${id}`)
    if (from_memory) {
      LOG.info(`reloading actor ${id} from its memory snapshot`)
      timings = await this.#start(record, state, mem, startup)
    } else {
      LOG.info(`booting actor ${id} from its disk`)
      await this.#update_harness(record)
      timings = await this.#boot_actor(record, startup)
    }
    const init_started = performance.now()
    Object.assign(
      record,
      await startup.run('initializing_actor', () =>
        this.#init_actor(record, { pi_after_recovery: true })
      )
    )
    const init_ms = performance.now() - init_started
    this.#write(record)
    this.trace(id, 'reload', {
      from_memory,
      machine_id: record.machine_id,
      hostname: record.hostname,
      ...timings,
      init_ms,
      ms: performance.now() - started
    })
    LOG.info(`actor ${id} is up, ${record.hostname}`)
    await this.#start_pi(record, startup)
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
      firecracker.pid_for_api_sock(record.api_sock) ?? record.pid
    )
    if (record.tap) syscalls.delete_tap(record.tap)
    rm_sync(record.dir, { recursive: true, force: true })
    rm_sync(join(this.published_dir, record.id), {
      recursive: true,
      force: true
    })
    rm_sync(join(this.versions_dir, record.id), {
      recursive: true,
      force: true
    })
  }

  #trace_path(id) {
    return join(this.traces_dir, `${id}.jsonl`)
  }

  /** Best effort: a trace that cannot be written must not fail what it describes. */
  trace(id, event, fields = {}) {
    const line = Object.fromEntries(
      Object.entries({ ts: now_iso(), event, ...fields }).sort(([a], [b]) =>
        a < b ? -1 : 1
      )
    )
    try {
      mkdir_sync(this.traces_dir, { recursive: true })
      append_file_sync(this.#trace_path(id), `${JSON.stringify(line)}\n`)
    } catch (error) {
      LOG.warn(`could not trace ${id} ${event}: ${error.message}`)
    }
  }

  trace_of(id, limit) {
    const path = this.#trace_path(id)
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
  first_turn(id, now = Date.now()) {
    if (this.turned.has(id)) return null
    this.turned.add(id)
    if (this.trace_of(id).some(row => row.event === 'first-turn')) return null
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
    return this.publishing.run(async () => {
      const target = join(this.published_dir, id)
      const staging = join(this.published_dir, `.${id}.part`)
      await this.copy_out(id, tree, staging)
      if (this.sync_sites) {
        const source = join(this.published_dir, `.${id}.source.part`)
        try {
          if (
            tree === '/realness/work/site' ||
            tree.startsWith('/realness/work/site/')
          )
            await this.copy_out(id, '/realness/work/site', source)
          const published = await this.sync_sites.publish(
            this.owner_of(id),
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
      await this.lock.run(() => {
        const previous = this.save_site(id)
        try {
          rename_sync(staging, target)
        } catch (error) {
          if (previous) {
            rename_sync(join(this.versions_dir, id, previous), target)
            unlink(join(this.versions_dir, id, `${previous}.json`))
          }
          throw error
        }
      })
      const files = list_files(target)
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
  save_site(id) {
    const target = join(this.published_dir, id)
    if (!exists_sync(target)) return null
    const version = random_bytes(ID_BYTES).toString('hex')
    const directory = join(this.versions_dir, id)
    mkdir_sync(directory, { recursive: true })
    rename_sync(target, join(directory, version))
    write_json(join(directory, `${version}.json`), {
      id: version,
      saved: new Date().toISOString()
    })
    return version
  }

  site_versions(id, site = id) {
    if (this.sync_sites)
      return this.sync_sites.versions(this.owner_of(id), site)
    const directory = join(this.versions_dir, id)
    if (!exists_sync(directory)) return []
    return readdir_sync(directory)
      .filter(name => /^[0-9a-f]{12}\.json$/.test(name))
      .map(name => read_json(join(directory, name)))
      .sort((a, b) => b.saved.localeCompare(a.saved))
  }

  restore_site(id, version, site = id) {
    return this.lock.run(() => {
      if (this.sync_sites)
        return this.sync_sites.restore(this.owner_of(id), site, version)
      if (typeof version !== 'string' || !/^[0-9a-f]{12}$/.test(version))
        throw new BadRequest('invalid site version')
      const directory = join(this.versions_dir, id)
      const source = join(directory, version)
      if (!exists_sync(source)) throw new NotFound(version)
      const target = join(this.published_dir, id)
      this.save_site(id)
      rename_sync(source, target)
      unlink(join(directory, `${version}.json`))
      this.trace(id, 'restore-site', { version })
      return { url: `/s/${id}/` }
    })
  }

  unpublish_site(id, site = id) {
    return this.lock.run(() => {
      if (this.sync_sites)
        return this.sync_sites.remove(this.owner_of(id), site)
      const version = this.save_site(id)
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
  async receive_log(id, log) {
    await this.ensure_running(id)
    const bytes = Buffer.from(JSON.stringify(log), 'utf8')
    const digest = create_hash('sha256').update(bytes).digest('hex')
    const snapshot = `${HANDS_OVER}.${digest}`
    const result = await this.exec(
      id,
      [
        'sh',
        '-c',
        `mkdir -p $(dirname ${HANDS_OVER}) && tee ${snapshot} >/dev/null && ln -sfn ${snapshot} ${HANDS_OVER}.next && mv -Tf ${HANDS_OVER}.next ${HANDS_OVER}`
      ],
      { stdin: bytes }
    )
    if (result.exit_code !== 0)
      throw new BadRequest(
        `could not leave the session log: ${result.exit_code}`
      )
    return { written: true }
  }

  /** Copy an actor's directory into a fresh `dest`; only plain entries survive. */
  async copy_out(id, tree, dest) {
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
      syscalls.run(
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
      keep_plain_entries(dest)
    } catch (error) {
      rm_sync(dest, { recursive: true, force: true })
      throw error
    }
  }

  published_site(id) {
    if (!ID.test(id)) return null
    const root = join(this.published_dir, id)
    return exists_sync(root) && stat_sync(root).isDirectory() ? root : null
  }

  exports() {
    if (!exists_sync(this.exports_dir)) return []
    return readdir_sync(this.exports_dir)
      .sort()
      .filter(name =>
        exists_sync(join(this.exports_dir, name, 'manifest.json'))
      )
      .map(name => read_json(join(this.exports_dir, name, 'manifest.json')))
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
    const target = join(this.exports_dir, id)
    const staging = join(this.exports_dir, `.${id}.part`)
    rm_sync(staging, { recursive: true, force: true })
    mkdir_sync(staging, { recursive: true })
    let manifest
    try {
      const artifacts = join(staging, 'artifacts.tar.gz')
      await syscalls.mounted(disk, tree =>
        syscalls.run(['tar', '-czf', artifacts, '-C', tree, ...ARTIFACT_PATHS])
      )
      const listed = syscalls.run(['tar', '-tzf', artifacts]).output
      const trace_path = this.#trace_path(id)
      const trace_text = exists_sync(trace_path)
        ? read_file_sync(trace_path, 'utf8')
        : ''
      write_file_sync(join(staging, 'trace.jsonl'), trace_text)
      manifest = {
        schema: 1,
        id,
        exported: now_iso(),
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
          sha256: await sha256_file(artifacts),
          entries: listed.split('\n').filter(Boolean).length,
          paths: ARTIFACT_PATHS
        },
        trace: {
          path: 'trace.jsonl',
          events: trace_text.split('\n').filter(line => line.trim()).length,
          bytes: Buffer.byteLength(trace_text)
        },
        seed: this.seed_fingerprint()
      }
      write_json(join(staging, 'manifest.json'), manifest)
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
  restore(export_id, owner, { start = true } = {}) {
    return this.lock.run(async () => {
      if (!ID.test(export_id)) throw new NotFound(`export ${export_id}`)
      const export_dir = join(this.exports_dir, export_id)
      if (!exists_sync(join(export_dir, 'manifest.json')))
        throw new NotFound(`export ${export_id}`)
      const manifest = read_json(join(export_dir, 'manifest.json'))
      if (!manifest.actor?.owner || manifest.actor.owner !== owner)
        throw new NotFound(`export ${export_id}`)
      const artifacts = join(export_dir, manifest.artifacts.path)
      const digest = await sha256_file(artifacts)
      if (digest !== manifest.artifacts.sha256)
        throw new BadRequest(
          `export ${export_id} is corrupt: ${digest.slice(0, DIGEST_SHOWN)} != ${manifest.artifacts.sha256.slice(0, DIGEST_SHOWN)}`
        )

      this.#claim_memory()
      try {
        let record = await this.#create(owner)
        try {
          await this.#idle(record.id, 'disk')
          await syscalls.mounted(join(record.dir, DISK), tree =>
            syscalls.run([
              'tar',
              '-xzf',
              artifacts,
              '-C',
              tree,
              '--no-same-owner'
            ])
          )
          const trace_path = this.#trace_path(record.id)
          const current = exists_sync(trace_path)
            ? read_file_sync(trace_path, 'utf8')
            : ''
          write_file_sync(
            trace_path,
            read_file_sync(join(export_dir, 'trace.jsonl'), 'utf8') + current
          )
          const seed = this.seed_fingerprint()
          this.trace(record.id, 'restore', {
            source: export_id,
            artifacts_sha256: digest,
            seed,
            seed_of_export: manifest.seed ?? null,
            seed_matches: JSON.stringify(seed) === JSON.stringify(manifest.seed)
          })
          if (start) record = await this.#reload(record.id)
        } catch (error) {
          LOG.warn(`restore of ${export_id} failed, rolling back`)
          await this.#teardown(record)
          throw error
        }
        LOG.info(`actor ${record.id} restored from ${export_id}`)
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
    write_json(join(record.dir, 'actor.json'), {
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
    const stored = read_json(join(dir, 'actor.json'))
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
    if (firecracker.pid_for_api_sock(record.api_sock)) record.state = 'running'
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
  owner_of(id) {
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

  live_actors() {
    return this.list().filter(record => record.state === 'running')
  }
}

/** End a parking pass early: serve again, and say why. */
const unpark = (store, reason) => {
  store.reopen()
  return /** @type {const} */ ({ ok: false, reason })
}

/** Drop devices, fifos, and sockets from an untrusted tree. */
const keep_plain_entries = root => {
  for (const entry of readdir_sync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) keep_plain_entries(path)
    else if (!entry.isFile() && !entry.isSymbolicLink()) unlink_sync(path)
  }
}

const list_files = root =>
  readdir_sync(root, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
