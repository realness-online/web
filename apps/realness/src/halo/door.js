import { existsSync as exists_sync, rmSync as rm_sync } from 'node:fs'
import { hostname } from 'node:os'
import { createServer as create_server } from 'node:net'
import { logger } from './log.js'
import { Loops } from './loops.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import {
  active_scouts,
  due_scouts,
  run_scout_loop
} from '#root/src/scouts/halo.js'
import { find_scout, scout_pages } from '#root/src/scouts/scout.js'
import { scout_preflight } from '#root/src/scouts/preflight.js'
import { scout_probe } from '#root/src/scouts/probe.js'
import { site_read } from './site-read.js'
import { site_of } from './cookie-jar.js'
import { Lines } from './vsock.js'
import { tap_guest } from './syscalls.js'
import { halo_pass_secret } from '#root/src/sign-on/node/halo-secret.js'
import { can } from '#root/src/can/can.js'
import {
  issue_harness_pass,
  issue_recovery_pass
} from '#root/src/sign-on/node/recovery-pass.js'
import { issue_model_pass } from '#root/src/proxy/model-pass.js'
/* eslint-disable no-await-in-loop -- polling waits between tries */

const LINE_LIMIT_BITS = 16
const WAIT_MS = 5000
const POLL_MS = 100
const HELLO_SECONDS = 10

/** hs-f2: the GCE instance name, which sync fences by; omitted when the name is not one. */
const halo_claim = () => {
  const name = hostname().split('.')[0].toLowerCase()
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(name) ? { halo: name } : {}
}

const LOG = logger('door')
/** An ISO date is the first ten characters of the full stamp. */
const DATE_LENGTH = 10

/** Only the box store mounts this machine's vault; the firecracker store mounts none. */
const host_vault_of = store => ('host_vault' in store ? store.host_vault : null)

/** The owner's own halo, which is the only place a scout may run. */
const owner_vault = (door, owner) => {
  const vault = door.store.host_vault
  if (vault?.owner !== owner)
    throw new Error("scouts run only on the owner's own halo")
  return vault
}

/** Start one scout's loop without waiting for it; its log line lands when it ends. */
const start_scout = (door, id, owner, vault, scout) => {
  door.scouting.add(scout)
  return run_scout_loop({
    loops: loops_of(door),
    parent: id,
    scout,
    vault_dir: vault.path,
    person: `/${owner}`,
    date: new Date().toISOString().slice(0, DATE_LENGTH),
    preflight: () => scout_preflight(door)
  })
    .then(
      ({ fresh, path }) =>
        LOG.info(`door: scout ${scout} wrote ${fresh.length} new to ${path}`),
      error => LOG.error(`door: scout ${scout} failed: ${error.message}`)
    )
    .finally(() => door.scouting.delete(scout))
}

const DOOR_PORT = 54
const LINE_LIMIT = 1 << LINE_LIMIT_BITS
const RECONCILE_MS = 500
const LOOP_WATCH_MS = 30_000
const SCOUT_WATCH_MS = 5 * MS_PER_MINUTE

/** The guest's door socket for an actor; listening once the reconciler has run for it. */
export const door_path = vsock_path => `${vsock_path}_${DOOR_PORT}`

/** Resolves true once the actor's door is listening; false after `timeout_ms`. */
export const wait_for_door = async (
  vsock_path,
  { timeout_ms = WAIT_MS, every_ms = POLL_MS } = {}
) => {
  const ends = Date.now() + timeout_ms
  while (!exists_sync(door_path(vsock_path))) {
    if (Date.now() >= ends) return false
    await new Promise(done => {
      setTimeout(done, every_ms)
    })
  }
  return true
}

/**
 * @typedef {{ id: string, owner: string, record: any, request: any, site: string }} Ask
 * @typedef {(door: Door, ask: Ask) => unknown} Answer
 */

/** @param {Door} door */
const loops_of = door => (door.loops ??= new Loops(door.store))

/** @param {Door} door @param {string} site */
const site_url_of = (door, site) => door.site_url.replaceAll('{id}', site)

/** @param {typeof issue_recovery_pass} issue @returns {Answer} */
const pass_of =
  issue =>
  (door, { id, owner, record }) => ({
    ok: true,
    pass: issue(
      { phone: owner, id, paths: record.paths ?? null, ...halo_claim() },
      halo_pass_secret()
    )
  })

/** @type {Answer} */
const manage_site = async (door, { id, request, site }) => {
  const result =
    request.op === 'site-restore'
      ? await door.store.restore_site(id, request.version, site)
      : await door.store.unpublish_site(id, site)
  return { ok: true, ...result, url: site_url_of(door, site) }
}

/** The address a copy is opened to: a tap actor's guest, or a box's own guest. */
const lease_ip = record =>
  record.address?.guest ?? (record.tap ? tap_guest(record.tap) : null)

/**
 * @type {Answer}
 * A `site` names the cookie jar the copy keeps, so a logged-in site stays
 * logged in across runs.
 */
const use_chrome = async (door, { id, owner, record, request }) => {
  if (!door.chrome) throw new Error('this halo has no chrome pool')
  if (request.op === 'chrome-return')
    return { ok: true, returned: await door.chrome.give_back(id) }
  const actor_ip = lease_ip(record)
  if (!actor_ip) throw new Error('actor has no network')
  const lease = await door.chrome.lease(id, actor_ip, {
    site: request.site ?? null,
    owner
  })
  return { ok: true, ...lease }
}

/**
 * What an actor may ask its door. `refused` is the error when the owner lacks
 * the right; `site` ops check the site belongs to the actor and act on `/site`.
 */
/** @type {Record<string, { refused: string, action?: string, site?: boolean, answer: Answer }>} */
const OPS = {
  'recovery-pass': {
    refused: 'actor cannot recover',
    answer: pass_of(issue_recovery_pass)
  },
  'harness-pass': {
    refused: 'actor cannot sync',
    answer: pass_of(issue_harness_pass)
  },
  'model-pass': {
    refused: 'actor cannot call models',
    answer: (door, { id, owner }) => ({
      ok: true,
      pass: issue_model_pass(
        { phone: owner, id },
        process.env.MODEL_PASS_SECRET ?? ''
      )
    })
  },
  'loop-report': {
    refused: 'actor cannot read loops',
    answer: (door, { id, request }) => ({
      ok: true,
      loop: loops_of(door).report(id, request.id)
    })
  },
  loop: {
    refused: 'actor cannot start loops',
    answer: async (door, { id, request }) => {
      const loop = await loops_of(door).start(id, request.goal)
      LOG.info(`door: ${id} started loop ${loop.id} at depth ${loop.depth}`)
      return { ok: true, ...loop }
    }
  },
  scout: {
    refused: 'actor cannot start loops',
    answer: async (door, { id, owner, record, request }) => {
      const vault = owner_vault(door, owner)
      const page = find_scout(scout_pages(vault.path), String(request.scout))
      if (request.probe) {
        const actor_ip = lease_ip(record)
        if (!actor_ip) throw new Error('the actor has no network')
        return {
          ok: true,
          probe: await scout_probe(door, { id, owner, actor_ip })
        }
      }
      if (page.status !== 'active')
        throw new Error(`${page.path} is ${page.status || 'missing a status'}`)
      start_scout(door, id, owner, vault, page.path)
      return { ok: true, scout: page.path }
    }
  },
  scouts: {
    refused: 'actor cannot start loops',
    answer: (door, { id, owner }) => {
      const vault = owner_vault(door, owner)
      const pages = active_scouts(vault.path)
      for (const page of pages) start_scout(door, id, owner, vault, page.path)
      return { ok: true, scouts: pages.map(page => page.path) }
    }
  },
  read: {
    refused: 'actor cannot read the web',
    answer: async (door, { id, owner, record, request }) => {
      if (request.site) {
        const actor_ip = lease_ip(record)
        if (!actor_ip) throw new Error('the actor has no network')
        const page = await site_read(
          door,
          { id, owner, actor_ip, site: site_of(request.site) },
          String(request.url ?? '')
        )
        return {
          ok: true,
          source: 'chrome',
          kind: 'html',
          body: page.html,
          status: page.status,
          site: page.site
        }
      }
      if (!door.web) throw new Error('this halo has no internet engine')
      return {
        ok: true,
        ...(await door.web.read(String(request.url ?? ''), {
          actor: id,
          fresh: request.fresh === true
        }))
      }
    }
  },
  'chrome-lease': { refused: 'actor cannot use chrome', answer: use_chrome },
  'chrome-return': { refused: 'actor cannot use chrome', answer: use_chrome },
  'site-versions': {
    refused: 'actor cannot read site versions',
    site: true,
    answer: async (door, { id, site }) => ({
      ok: true,
      versions: await door.store.site_versions(id, site)
    })
  },
  'site-restore': {
    refused: 'actor cannot manage site',
    action: 'write',
    site: true,
    answer: manage_site
  },
  'site-remove': {
    refused: 'actor cannot manage site',
    action: 'write',
    site: true,
    answer: manage_site
  },
  publish: {
    refused: 'actor cannot publish',
    action: 'write',
    site: true,
    answer: async (door, { id, request, site }) => {
      const path = request.path || '/realness/site'
      await door.store.publish(id, path, site)
      LOG.info(`door: ${id} published ${path}`)
      return { ok: true, site, url: site_url_of(door, site) }
    }
  }
}

export class Door {
  /**
   * @param {import('./actors.js').HaloStore} store
   * @param {string} [site_url]
   * @param {import('./loops.js').Loops | null} [loops]
   * @param {import('./chrome-leases.js').ChromeLeases | null} [chrome]
   * @param {import('./web-engine.js').WebEngine | null} [web]
   */
  constructor(
    store,
    site_url = '/s/{id}/',
    loops = null,
    chrome = null,
    web = null
  ) {
    this.web = web
    this.store = store
    this.site_url = site_url
    this.loops = loops
    this.chrome = chrome
    this.listeners = new Map()
    this.scouting = new Set()
  }

  start() {
    this.#watch_loops()
    this.#watch_scouts()
    const tick = () => {
      try {
        this.reconcile()
      } catch (error) {
        LOG.error('door reconcile failed', error)
      }
      this.timer = setTimeout(tick, RECONCILE_MS)
    }
    tick()
  }

  /**
   * The owner's own box: the actor a timed scout run hangs off. Loop actors are
   * left out, so the run lands at depth one.
   * @param {string} owner
   */
  #owner_box(owner) {
    const loops = Object.keys(this.loops?.loops ?? {})
    const own = this.store
      .list()
      .filter(record => record.owner === owner && !loops.includes(record.id))
    return own.find(record => record.state === 'running') ?? own[0] ?? null
  }

  /**
   * Start every scout whose budget says now, on the owner's own box, which is
   * woken first: a halo restart leaves it stopped and the door shut.
   * @returns {Promise<string[]>} the scouts it started
   */
  async run_due_scouts() {
    const vault = host_vault_of(this.store)
    if (!vault) return []
    const due = await due_scouts(vault.path, {
      date: new Date().toISOString().slice(0, DATE_LENGTH),
      running: this.scouting
    })
    if (!due.length) return []
    const box = this.#owner_box(vault.owner)
    if (!box) throw new Error('no actor to run scouts from')
    await this.store.ensure_running(box.id)
    for (const page of due)
      start_scout(this, box.id, vault.owner, vault, page.path)
    return due.map(page => page.path)
  }

  #watch_scouts() {
    const tick = async () => {
      try {
        for (const scout of await this.run_due_scouts())
          LOG.info(`door: scout timer started ${scout}`)
      } catch (error) {
        LOG.error('scout timer failed', error)
      }
      this.scoutTimer = setTimeout(tick, SCOUT_WATCH_MS)
    }
    this.scoutTimer = setTimeout(tick, SCOUT_WATCH_MS)
  }

  #watch_loops() {
    const tick = async () => {
      try {
        for (const { id, reason } of await (this.loops ??= new Loops(
          this.store
        )).watch())
          LOG.info(`loop ${id} stopped: ${reason}`)
      } catch (error) {
        LOG.error('loop watch failed', error)
      }
      this.loopTimer = setTimeout(tick, LOOP_WATCH_MS)
    }
    this.loopTimer = setTimeout(tick, LOOP_WATCH_MS)
  }

  reconcile() {
    const live = new Map(
      this.store.live_actors().map(record => [record.id, record])
    )
    for (const [id, { path, server }] of this.listeners)
      if (!live.has(id) || !exists_sync(path)) {
        server.close()
        this.listeners.delete(id)
      }

    for (const [id, record] of live)
      if (!this.listeners.has(id)) this.#listen(record)
    if (this.chrome && !this.reaping)
      this.reaping = this.chrome
        .reap([...live.keys()])
        .catch(error => LOG.error('chrome lease reap failed', error))
        .finally(() => (this.reaping = null))
  }

  #listen(record) {
    const path = door_path(record.vsock_path)
    rm_sync(path, { force: true })
    const server = create_server(conn => this.#handle(record.id, conn))
    server.on('error', error =>
      LOG.warn(`door for ${record.id}: ${error.message}`)
    )
    server.listen(path)
    this.listeners.set(record.id, { path, server })
  }

  async #handle(id, conn) {
    let reply
    try {
      const line = await new Lines(conn, LINE_LIMIT).read(HELLO_SECONDS)
      if (line && line.length >= LINE_LIMIT)
        throw new Error('request line is too long')
      reply = await this.#answer(
        id,
        JSON.parse(line?.length ? line.toString('utf8') : '{}')
      )
    } catch (error) {
      if (!(error instanceof SyntaxError) && error.name !== 'BadRequest')
        LOG.warn(`door request from ${id} failed: ${error.message}`)
      reply = { ok: false, error: error.message }
    }
    conn.end(`${JSON.stringify(reply)}\n`)
  }

  #answer(id, request) {
    const record = this.store.get(id)
    const { owner } = record
    const known = Object.hasOwn(OPS, request.op)
    const op = known ? OPS[request.op] : OPS.publish
    const site = request.site ?? id
    if (op.site && !this.store.sync_sites && site !== id)
      throw new Error(
        'site belongs to another actor; sync sites are not configured'
      )
    if (!known) throw new Error(`unknown op '${request.op}'`)
    const path = `people/${owner}/harnesses/${id}${op.site ? '/site' : ''}`
    const instance = `/${owner}/harnesses/${id}`
    if (!owner || !can({ instance }, op.action ?? 'get', path))
      throw new Error(op.refused)
    return op.answer(this, { id, owner, record, request, site })
  }
}
