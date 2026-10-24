import { existsSync as exists_sync, rmSync as rm_sync } from 'node:fs'
import { hostname } from 'node:os'
import { createServer as create_server } from 'node:net'
import { logger } from './log.js'
import { Loops } from './loops.js'
import { Lines } from './vsock.js'
import { tapGuest as tap_guest } from './syscalls.js'
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
const DOOR_PORT = 54
const LINE_LIMIT = 1 << LINE_LIMIT_BITS
const RECONCILE_MS = 500
const LOOP_WATCH_MS = 30_000

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

export class Door {
  /**
   * @param {import('./actors.js').ActorStore} store
   * @param {string} [siteUrl]
   * @param {import('./loops.js').Loops | null} [loops]
   * @param {import('./chrome-leases.js').ChromeLeases | null} [chrome]
   * @param {import('./web-engine.js').WebEngine | null} [web]
   */
  constructor(
    store,
    siteUrl = '/s/{id}/',
    loops = null,
    chrome = null,
    web = null
  ) {
    this.web = web
    this.store = store
    this.siteUrl = siteUrl
    this.loops = loops
    this.chrome = chrome
    this.listeners = new Map()
  }

  start() {
    this.#watchLoops()
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

  #watchLoops() {
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
      this.store.liveActors().map(record => [record.id, record])
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

  async #answer(id, request) {
    const record = this.store.get(id)
    const { owner } = record
    const instance = `/${owner}/harnesses/${id}`
    const permit = (message, action = 'get', suffix = '') => {
      const path = `people/${owner}/harnesses/${id}${suffix}`
      if (!owner || !can({ instance }, action, path)) throw new Error(message)
      return owner
    }
    if (request.op === 'recovery-pass') {
      permit('actor cannot recover')
      return {
        ok: true,
        pass: issue_recovery_pass(
          { phone: owner, id, paths: record.paths ?? null, ...halo_claim() },
          halo_pass_secret()
        )
      }
    }
    if (request.op === 'harness-pass') {
      permit('actor cannot sync')
      return {
        ok: true,
        pass: issue_harness_pass(
          { phone: owner, id, paths: record.paths ?? null, ...halo_claim() },
          halo_pass_secret()
        )
      }
    }
    if (request.op === 'model-pass') {
      const owner_phone = permit('actor cannot call models')
      return {
        ok: true,
        pass: issue_model_pass(
          { phone: owner_phone, id },
          process.env.MODEL_PASS_SECRET ?? ''
        )
      }
    }
    if (request.op === 'loop-report') {
      permit('actor cannot read loops')
      return {
        ok: true,
        loop: (this.loops ??= new Loops(this.store)).report(id, request.id)
      }
    }
    if (request.op === 'loop') {
      permit('actor cannot start loops')
      const loop = await (this.loops ??= new Loops(this.store)).start(
        id,
        request.goal
      )
      LOG.info(`door: ${id} started loop ${loop.id} at depth ${loop.depth}`)
      return { ok: true, ...loop }
    }
    if (request.op === 'read') {
      permit('actor cannot read the web')
      if (!this.web) throw new Error('this halo has no internet engine')
      return {
        ok: true,
        ...(await this.web.read(String(request.url ?? ''), {
          actor: id,
          fresh: request.fresh === true
        }))
      }
    }
    if (request.op === 'chrome-lease' || request.op === 'chrome-return') {
      permit('actor cannot use chrome')
      if (!this.chrome) throw new Error('this halo has no chrome pool')
      if (request.op === 'chrome-return')
        return { ok: true, returned: await this.chrome.give_back(id) }
      if (!record.tap) throw new Error('actor has no network')
      return {
        ok: true,
        ...(await this.chrome.lease(id, tap_guest(record.tap)))
      }
    }
    const site = request.site ?? id
    if (!this.store.sync_sites && site !== id)
      throw new Error(
        'site belongs to another actor; sync sites are not configured'
      )
    if (request.op === 'site-versions') {
      permit('actor cannot read site versions', 'get', '/site')
      return { ok: true, versions: await this.store.siteVersions(id, site) }
    }
    if (request.op === 'site-restore' || request.op === 'site-remove') {
      permit('actor cannot manage site', 'write', '/site')
      const result =
        request.op === 'site-restore'
          ? await this.store.restoreSite(id, request.version, site)
          : await this.store.unpublishSite(id, site)
      return { ok: true, ...result, url: this.siteUrl.replaceAll('{id}', site) }
    }
    if (request.op !== 'publish') throw new Error(`unknown op '${request.op}'`)
    permit('actor cannot publish', 'write', '/site')
    const path = request.path || '/realness/site'
    await this.store.publish(id, path, site)
    LOG.info(`door: ${id} published ${path}`)
    return { ok: true, site, url: this.siteUrl.replaceAll('{id}', site) }
  }
}
