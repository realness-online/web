import { existsSync as exists_sync, rmSync as rm_sync } from 'node:fs'
import { readFile as read_file } from 'node:fs/promises'
import { hostname } from 'node:os'
import { createServer as create_server } from 'node:net'
import { join } from 'node:path'
import { logger } from './log.js'
import { Loops } from './loops.js'
import {
  active_scouts,
  due_scouts,
  run_scout_box
} from '#root/src/scouts/halo.js'
import { find_scout, scout_pages } from '#root/src/scouts/scout.js'
import { source_sections } from '#root/src/scouts/sources.js'
import { scout_probe } from '#root/src/scouts/probe.js'
import { site_of } from './cookie-jar.js'
import { Lines } from './vsock.js'
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

/**
 * The owner's own box: the actor a scout run hangs off. Loop actors are left
 * out, so the run lands on the box the owner opened.
 * @param {Door} door
 * @param {string} owner
 */
const owner_box = (door, owner) => {
  const loops = Object.keys(door.loops?.loops ?? {})
  const own = door.store
    .list()
    .filter(record => record.owner === owner && !loops.includes(record.id))
  return own.find(record => record.state === 'running') ?? own[0] ?? null
}

/**
 * Start one scout's run in the owner's box, without waiting for it; its log
 * line lands when the box's pi ends. The box reaches the model through the door,
 * so its rights and limits hold, and the read keeps the box's cookies.
 */
const start_scout = async ({ door, id, owner, vault, scout, source = '' }) => {
  const key = `${scout}|${source}`
  door.scouting.add(key)
  const box = owner_box(door, owner)
  if (!box) throw new Error('no box to run scouts in')
  await door.store.ensure_running(box.id)
  return run_scout_box({ store: door.store, actor: box.id, scout, source })
    .then(
      ({ code, said }) =>
        code
          ? LOG.error(`door: scout ${scout} ${source} exited ${code}: ${said}`)
          : LOG.info(`door: scout ${scout} ${source} done: ${said}`),
      error =>
        LOG.error(`door: scout ${scout} ${source} failed: ${error.message}`)
    )
    .finally(() => door.scouting.delete(key))
}

const DOOR_PORT = 54
const LINE_LIMIT = 1 << LINE_LIMIT_BITS
const RECONCILE_MS = 500
const LOOP_WATCH_MS = 15_000

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

/**
 * @type {Answer}
 * A site's saved login, for the owner's own box to load into its own Chrome and
 * to give back when it is done. The jar stays on the halo; only the cookies
 * cross, and only into the owner's box.
 */
const use_jar = async (door, { owner, request }) => {
  if (!door.jars) throw new Error('this halo has no cookie jars')
  const site = site_of(request.site)
  if (Array.isArray(request.save)) {
    await door.jars.save(owner, site, request.save)
    return { ok: true, saved: request.save.length }
  }
  return { ok: true, cookies: await door.jars.load(owner, site) }
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
      if (request.probe)
        return { ok: true, probe: await scout_probe(door, owner) }
      if (page.status !== 'active')
        throw new Error(`${page.path} is ${page.status || 'missing a status'}`)
      const source = String(request.source ?? '')
      start_scout({ door, id, owner, vault, scout: page.path, source })
      return { ok: true, scout: page.path, source }
    }
  },
  scouts: {
    refused: 'actor cannot start loops',
    answer: async (door, { id, owner }) => {
      const vault = owner_vault(door, owner)
      const started = []
      for (const page of active_scouts(vault.path)) {
        const doc = await read_file(
          join(page.folder, 'Sources.md'),
          'utf8'
        ).catch(() => '')
        const sections = source_sections(doc)
        const keys = sections.length ? sections.map(one => one.key) : ['']
        for (const key of keys) {
          start_scout({ door, id, owner, vault, scout: page.path, source: key })
          started.push(`${page.path} ${key}`.trim())
        }
      }
      return { ok: true, scouts: started }
    }
  },
  read: {
    refused: 'actor cannot read the web',
    answer: async (door, { id, request }) => {
      if (request.site)
        throw new Error(
          'a login site is read in the box that holds it: pass the cookies, not a site'
        )
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
  'site-cookies': { refused: 'actor cannot read its login', answer: use_jar },
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
   * @param {{ load: Function, save: Function } | null} [jars]
   * @param {import('./web-engine.js').WebEngine | null} [web]
   */
  constructor(
    store,
    site_url = '/s/{id}/',
    loops = null,
    jars = null,
    web = null
  ) {
    this.web = web
    this.store = store
    this.site_url = site_url
    this.loops = loops
    this.jars = jars
    this.listeners = new Map()
    this.scouting = new Set()
  }

  start() {
    this.#watch_loops()
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
   * Start every scout whose budget says now, on the owner's own box, which is
   * woken first: a halo restart leaves it stopped and the door shut.
   * @returns {Promise<string[]>} the scouts it started
   */
  async run_due_scouts() {
    const vault = host_vault_of(this.store)
    if (!vault) return []
    if (this.scouting.size) return []
    const due = await due_scouts(vault.path, {
      date: new Date().toISOString().slice(0, DATE_LENGTH),
      running: this.scouting
    })
    if (!due.length) return []
    const box = owner_box(this, vault.owner)
    if (!box) throw new Error('no actor to run scouts from')
    await this.store.ensure_running(box.id)
    const [next] = due
    start_scout({
      door: this,
      id: box.id,
      owner: vault.owner,
      vault,
      scout: next.page.path,
      source: next.source
    })
    return [`${next.page.path} ${next.source}`.trim()]
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
