/**
 * The sync service over HTTP. Every request: phone token, then `can()`,
 * then storage, then one log line with phone numbers hashed.
 *
 *   GET    /people/+A/posters/     list a folder (trailing slash)
 *   GET    /people/+A/vault/?deep  every file below, name to version
 *   GET    /people/+A/index.html.gz
 *   PUT    /people/+A/vault/note.md   If-Match: "<version>" or If-None-Match: *
 *   DELETE /people/+A/vault/note.md   If-Match optional
 *
 * No token is a stranger; a bad token is 401. Denial is 403 whether or not
 * the file exists, because the check runs before storage is touched.
 *
 * Browsers may call it only from `origins`, the sites allowed to read and write.
 */
import {
  createHash as create_hash,
  timingSafeEqual as timing_safe_equal
} from 'node:crypto'
import { createServer as create_server } from 'node:http'
import { can, identify } from '#root/src/can/index.js'
import {
  issue_halo_pass,
  verify_halo_pass,
  verify_record_pass,
  record_halo
} from '#root/src/sign-on/node/halo-pass.js'
import { verify_gate_pass } from '#root/src/sign-on/node/gate-pass.js'
import { run_halo_alerts } from './halo-alerts.js'
import { halo_health } from './halo-watch.js'
import { site_request } from './sites.js'
import {
  harness_path,
  recovery_path,
  verify_harness_pass,
  verify_recovery_pass
} from '#root/src/sign-on/node/recovery-pass.js'
import { rights_key } from './rights.js'
import { admins as admin_list } from './admins.js'
import { git_token, GitRefused } from './git.js'
import { HTTP } from '#root/lib/http.js'
import { MIB } from '#root/lib/units.js'

const LIMIT_MIB = 10
const HASH_SHOWN = 12

const LIMIT = LIMIT_MIB * MIB
const PHONES = /\+[1-9]\d{6,14}/g

/** Logs hash numbers and never store them raw. */
const hash_phones = text =>
  text.replace(
    PHONES,
    phone =>
      `#${create_hash('sha256').update(phone).digest('hex').slice(0, HASH_SHOWN)}`
  )

/**
 * Pins live at `pins/+A`, written once; `can()` denies that root to everyone.
 * A pin never changes once written, so each is read from storage only once.
 */
/**
 * One uid per number, kept under `prefix`. Each issuer keeps its own pins,
 * since a uid means something only to the issuer that made it.
 * @param {any} storage A `can` store.
 * @param {string} [prefix]
 */
export const storage_pins = (storage, prefix = 'pins') => {
  const known = new Map()
  return {
    async claim(phone, uid) {
      if (known.has(phone)) return known.get(phone)
      let pinned = uid
      try {
        await storage.put(`${prefix}/${phone}`, uid, { if_absent: true })
      } catch (error) {
        if (error.code !== 'conflict') throw error
        pinned = (await storage.get(`${prefix}/${phone}`))?.body.toString(
          'utf8'
        )
      }
      if (pinned) known.set(phone, pinned)
      return pinned
    }
  }
}

/** Where Realness sign-in keeps its pins, apart from Firebase's. */
export const PINS_REALNESS = 'pins-realness'

class Status extends Error {
  constructor(status) {
    super(String(status))
    this.status = status
  }
}

const action_for = (method, path) =>
  ({
    GET: path.endsWith('/') || path === '' ? 'list' : 'get',
    HEAD: path.endsWith('/') || path === '' ? undefined : 'get',
    PUT: 'write',
    DELETE: 'delete'
  })[method]

const version_from = value => value?.replace(/^W\//, '').replace(/^"|"$/g, '')

const request_path = url => {
  try {
    return decodeURIComponent((url ?? '/').split('?')[0].slice(1))
  } catch {
    return null
  }
}

const read_body = async request => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Status(HTTP.PAYLOAD_TOO_LARGE)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * The meta a write may carry, each as an `x-meta-*` header: what we know
 * about the data that its bytes cannot say. Anything else is refused.
 */
const META_HEADERS = {
  sold: 'x-meta-sold',
  fullLocale: 'x-meta-full-locale'
}
const META_LIST = Object.values(META_HEADERS).join(', ')

/** A write's meta from its headers; an unknown `x-meta-*` is a bad request. */
const meta_from = headers => {
  const known = new Set(Object.values(META_HEADERS))
  if (
    Object.keys(headers).some(
      name => name.startsWith('x-meta-') && !known.has(name)
    )
  )
    throw new Status(HTTP.BAD_REQUEST)
  return Object.fromEntries(
    Object.entries(META_HEADERS)
      .filter(([, header]) => typeof headers[header] === 'string')
      .map(([key, header]) => [key, String(headers[header])])
  )
}

/** A file's meta as response headers. */
const meta_headers = (meta = {}) =>
  Object.fromEntries(
    Object.entries(META_HEADERS)
      .filter(([key]) => typeof meta[key] === 'string')
      .map(([key, header]) => [header, meta[key]])
  )

const PREFLIGHT = {
  'access-control-allow-methods': 'GET, HEAD, PUT, DELETE, POST',
  'access-control-allow-headers': `authorization, content-type, if-match, if-none-match, ${META_LIST}`,
  'access-control-max-age': '600'
}

/**
 * A harness pass reaches only the owner's harness paths; a recovery pass is
 * read-only and stays in its own tree; a halo pass is limited to its site;
 * everyone else goes through `can()`.
 */
const caller_allowed = ({ action, grants, path, who }) => {
  if (who?.harness) return harness_path(path, who.harness, who.paths)
  if (who?.recovery)
    return (
      ['get', 'list'].includes(action) &&
      recovery_path(path, who.recovery, who.paths)
    )
  if (who?.halo)
    return (
      path.startsWith(`people/${who.phone}/work/site/`) &&
      can(who, action, path, grants)
    )
  return can(who, action, path, grants)
}

/** List a folder, or every file below it. */
const answer_list = async (storage, request, response, path) => {
  const query = new URLSearchParams((request.url ?? '').split('?')[1] ?? '')
  response.writeHead(HTTP.OK, { 'content-type': 'application/json' })
  let listing = storage.list(path)
  if (query.get('deep') === 'meta') listing = storage.walk_meta(path)
  else if (query.has('deep')) listing = storage.walk(path)
  return response.end(JSON.stringify(await listing))
}

/**
 * As storage.rules: a poster the prints webhook tagged sold is never
 * overwritten by its owner. Deleting stays open; a move is copy, then delete.
 */
const refuse_sold = async (storage, path, who) => {
  if (!path.startsWith('people/') || who?.admin) return
  const stored = await storage.get(path)
  if (stored?.meta?.sold === 'true') throw new Status(HTTP.FORBIDDEN)
}

/** The type and encoding come from the file: gzip bytes under an .html name. */
const GZIP_MAGIC = Buffer.from('1f8b', 'hex')
const gzipped_html = (path, body) =>
  path.endsWith('.html') && body.subarray(0, 2).equals(GZIP_MAGIC)

/** Send one file with its version as the etag. */
const answer_get = async (storage, response, path) => {
  const file = await storage.get(path)
  if (!file) throw new Status(HTTP.NOT_FOUND)
  response.writeHead(HTTP.OK, {
    etag: `"${file.version}"`,
    'content-type': 'application/octet-stream',
    ...(gzipped_html(path, file.body) && {
      'content-type': 'text/html; charset=utf-8',
      'content-encoding': 'gzip'
    }),
    ...meta_headers(file.meta)
  })
  return response.end(file.body)
}

/** Health checks and halo heartbeats repeat all day; only their failures log. */
const HEARTBEAT = /^halos\/[^/]+\/status\.html$/
export const routine = (method, path) =>
  (method === 'GET' && path === 'health') ||
  (method === 'PUT' && HEARTBEAT.test(path ?? ''))

/**
 * One log line per request, naming the caller's phone when the pass carries
 * one. Harness, recovery, and record passes log a dash.
 */
const request_line = (who, request, path, status, started) =>
  `${new Date().toISOString()} ${who && 'phone' in who ? who.phone : '-'} ${request.method} /${path ?? '(bad encoding)'} ${status} ${Date.now() - started}ms`

/** A two-part pass: recovery, harness, owner, or a halo record; a fenced halo is refused. */
const pass_identity = async (token, { halo_pass_secret, storage, fenced }) => {
  if (!halo_pass_secret) throw new Status(HTTP.UNAUTHORIZED)
  const recovery = attempt(() => verify_recovery_pass(token, halo_pass_secret))
  const harness = recovery
    ? null
    : attempt(() => verify_harness_pass(token, halo_pass_secret))
  if (await fenced((recovery ?? harness)?.halo))
    throw new Status(HTTP.UNAUTHORIZED)
  if (recovery)
    return {
      recovery: recovery.phone,
      id: recovery.id,
      paths: recovery.paths
    }
  if (harness)
    return { harness: harness.phone, id: harness.id, paths: harness.paths }
  const gate = attempt(() => verify_gate_pass(token, halo_pass_secret))
  if (gate) return gate
  const halo = attempt(() => verify_halo_pass(token, halo_pass_secret))
  if (halo) return { ...halo, halo: true }
  return record_identity(token, storage, fenced)
}

/** A verified pass, or null when this kind does not verify. */
const attempt = verify => {
  try {
    return verify()
  } catch {
    return null
  }
}

/** hs-f2: a revoked halo's fence; read through a short cache so each sync call is not a storage read. */
const FENCE_CACHE_MS = 10_000
export const fence_reader = (storage, now = Date.now) => {
  const seen = new Map()
  return async halo => {
    if (!halo) return false
    const hit = seen.get(halo)
    if (hit && now() - hit.at < FENCE_CACHE_MS) return hit.fenced
    const fenced = Boolean(await storage.get(`halo-fences/${halo}`))
    seen.set(halo, { fenced, at: now() })
    return fenced
  }
}

/** A halo's record pass, checked against the key it registered. */
const record_identity = async (token, storage, fenced) => {
  try {
    const halo = record_halo(token)
    if (await fenced(halo)) throw new Status(HTTP.UNAUTHORIZED)
    const key = await storage.get(`halo-keys/${halo}`)
    if (!key) throw new Status(HTTP.UNAUTHORIZED)
    return {
      halo_name: verify_record_pass(token, key.body.toString('utf8').trim())
        .halo
    }
  } catch {
    throw new Status(HTTP.UNAUTHORIZED)
  }
}

/** POST /v1/git-token: mint a repo token for the caller's harness. */
const answer_git_token = async (
  request,
  response,
  who,
  { git_app, git_fetch, log, storage }
) => {
  let repo
  try {
    ;({ repo } = JSON.parse((await read_body(request)).toString('utf8')))
  } catch {
    throw new Status(HTTP.BAD_REQUEST)
  }
  try {
    const minted = await git_token({
      storage,
      phone: who.harness,
      repo,
      app: git_app,
      fetcher: git_fetch
    })
    response.writeHead(HTTP.OK, {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    })
    response.end(JSON.stringify(minted))
  } catch (error) {
    if (!(error instanceof GitRefused)) throw error
    if (error.status === HTTP.BAD_GATEWAY)
      log(hash_phones(`git: ${error.message}`))
    throw new Status(error.status)
  }
}

/** POST /v1/halo-pass: a short-lived owner pass. */
const answer_halo_pass = (response, who, halo_pass_secret) => {
  if (!halo_pass_secret) throw new Status(HTTP.UNAVAILABLE)
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(
    JSON.stringify({
      pass: issue_halo_pass(who, halo_pass_secret),
      expires_in: 300
    })
  )
}

/** The caller behind a `v1/sites/` request, if any; plain `sites/` is public. */
const site_caller = (path, request, halo_pass_secret) => {
  if (!path.startsWith('v1/sites/')) return null
  const pass = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1]
  if (!pass || !halo_pass_secret) throw new Status(HTTP.UNAUTHORIZED)
  try {
    return verify_halo_pass(pass, halo_pass_secret)
  } catch {
    throw new Status(HTTP.UNAUTHORIZED)
  }
}

/** POST /v1/halo-watch/run: send the queued halo alerts. */
const answer_halo_alerts = async (
  request,
  response,
  { alert_call, alert_webhook, halo_statuses, log, storage }
) => {
  if (!alert_call(request)) throw new Status(HTTP.UNAUTHORIZED)
  const sent = await run_halo_alerts({
    storage,
    webhook: alert_webhook,
    statuses: halo_statuses,
    warn: message => log(hash_phones(message))
  })
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify({ sent }))
}

/** GET /halos/quiet.json: the admin's halo health report. */
const answer_quiet = async (
  response,
  who,
  { admins, halo_statuses, storage }
) => {
  if (!(await admins.has(who.phone))) throw new Status(HTTP.FORBIDDEN)
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(
    JSON.stringify(await halo_health(storage, { statuses: halo_statuses }))
  )
}

/**
 * The sync service.
 * @param {object} options
 * @param {{ get: (key: string) => Promise<{ body: Buffer, version: string | null, meta?: Record<string, string> } | null>, put: (key: string, body: Buffer | string, options?: object) => Promise<string>, delete: (key: string, options?: object) => Promise<void>, list: (path: string) => Promise<{ files: string[], folders: string[] }>, walk: (path: string) => Promise<Record<string, string>>, walk_meta: (path: string) => Promise<Record<string, { version: string, size: number, updated: string }>> }} options.storage
 * @param {{ grants: (owner: string) => Promise<{ grants: object[] }>, forget: (owner: string) => void }} options.rights
 * @param {string} options.project
 * @param {() => Promise<Record<string, string>>} options.certs
 * @param {string} [options.issuer] the token issuer; Firebase's by default
 * @param {string | undefined} options.halo_pass_secret enables the pass routes
 * @param {string | null} [options.alert_token]
 * @param {string | null} [options.alert_webhook]
 * @param {(() => Promise<Map<string, string>>) | null} [options.halo_statuses] provider status per halo name
 * @param {string[]} [options.origins] sites allowed to read and write
 * @param {{ app_id: string, private_key: string } | null} [options.git_app]
 * @param {typeof fetch} [options.git_fetch]
 * @param {(...parts: unknown[]) => void} [options.log]
 */
export const sync_service = ({
  storage,
  rights,
  project,
  certs,
  issuer,
  halo_pass_secret,
  alert_token = null,
  alert_webhook = null,
  halo_statuses = null,
  origins = [],
  git_app = null,
  git_fetch = fetch,
  log = console.info
}) => {
  const pins = storage_pins(storage, issuer ? PINS_REALNESS : undefined)
  const allowed = new Set(origins)

  /** Cloud Scheduler presents a shared secret; nothing else calls this. */
  const alert_call = request => {
    if (!alert_token) return false
    const given = Buffer.from(
      /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? ''
    )
    const wanted = Buffer.from(alert_token)
    return given.length === wanted.length && timing_safe_equal(given, wanted)
  }

  const fenced = fence_reader(storage)

  /** A halo's record pass, checked against the key it registered. */
  const who_is = async request => {
    const header = request.headers.authorization
    if (!header) return null
    const token = /^Bearer (\S+)$/.exec(header)?.[1]
    if (!token) throw new Status(HTTP.UNAUTHORIZED)
    if (token.split('.').length === 2)
      return pass_identity(token, { halo_pass_secret, storage, fenced })
    try {
      return await identify(token, { project, certs, issuer, pins })
    } catch {
      throw new Status(HTTP.UNAUTHORIZED)
    }
  }

  const admins = admin_list(storage)

  const handle = async (request, response, path, action, caller) => {
    const who =
      ['loops', 'halos', 'usage', 'billing'].includes(path.split('/')[0]) &&
      caller?.phone
        ? { ...caller, admin: await admins.has(caller.phone) }
        : caller
    const [, owner] = path.split('/')
    const grants =
      who?.instance && owner ? (await rights.grants(owner)).grants : []
    if (!caller_allowed({ action, grants, path, who }))
      throw new Status(HTTP.FORBIDDEN)

    if (action === 'list')
      return await answer_list(storage, request, response, path)
    if (action === 'get') return await answer_get(storage, response, path)

    const if_absent = request.headers['if-none-match'] === '*'
    const if_version = version_from(request.headers['if-match'])
    try {
      if (action === 'write') {
        const meta = meta_from(request.headers)
        const body = await read_body(request)
        await refuse_sold(storage, path, who)
        const version = await storage.put(path, body, {
          ...(if_absent ? { if_absent } : { if_version }),
          meta
        })
        response.writeHead(HTTP.OK, { etag: `"${version}"` })
      } else {
        await storage.delete(path, { if_version })
        response.writeHead(HTTP.NO_CONTENT)
      }
    } catch (error) {
      if (error.code === 'conflict') throw new Status(HTTP.PRECONDITION_FAILED)
      throw error
    }
    if (owner && path === rights_key(owner)) rights.forget(owner)
    response.end()
  }

  /**
   * Pick the handler for one request. Returns the caller it resolved, so the
   * log line can name them, plus the status to log.
   */
  const dispatch = async (request, response, path) => {
    const { method } = request
    if (path === null) throw new Status(HTTP.BAD_REQUEST)
    if (path === 'health' && method === 'GET') {
      response.writeHead(HTTP.OK, { 'content-type': 'text/plain' })
      response.end('ok')
      return null
    }
    if (path.startsWith('sites/') || path.startsWith('v1/sites/')) {
      const who = site_caller(path, request, halo_pass_secret)
      await site_request({
        storage,
        method,
        path,
        who,
        response,
        read_body: () => read_body(request)
      })
      return who
    }
    if (path === 'v1/halo-watch/run' && method === 'POST') {
      await answer_halo_alerts(request, response, {
        alert_call,
        alert_webhook,
        halo_statuses,
        log,
        storage
      })
      return null
    }
    if (path === 'halos/quiet.json' && method === 'GET') {
      const who = await who_is(request)
      if (!who?.phone) throw new Status(HTTP.UNAUTHORIZED)
      await answer_quiet(response, who, { admins, halo_statuses, storage })
      return who
    }
    if (path === 'v1/git-token' && method === 'POST') {
      const who = await who_is(request)
      if (!who?.harness) throw new Status(HTTP.UNAUTHORIZED)
      await answer_git_token(request, response, who, {
        git_app,
        git_fetch,
        log,
        storage
      })
      return who
    }
    if (path === 'v1/halo-pass' && method === 'POST') {
      const who = await who_is(request)
      if (!who?.phone) throw new Status(HTTP.UNAUTHORIZED)
      answer_halo_pass(response, who, halo_pass_secret)
      return who
    }
    const record = path.startsWith('v1/') ? path.slice(3) : path
    const action = action_for(method, record)
    if (!action) throw new Status(HTTP.METHOD_NOT_ALLOWED)
    const who = await who_is(request)
    await handle(request, response, record, action, who)
    return who
  }

  return create_server(async (request, response) => {
    const started = Date.now()
    const path = request_path(request.url)
    const { origin } = request.headers
    /** @type {{ phone: string } | { halo_name: string } | { recovery: string, id: string, paths: string[] | null } | { harness: string, id: string, paths: string[] | null } | null} */
    let who = null
    /** @type {number} */
    let status = HTTP.OK
    if (origin && allowed.has(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('access-control-expose-headers', `etag, ${META_LIST}`)
    }
    response.setHeader('vary', 'origin')
    try {
      if (request.method === 'OPTIONS') {
        if (!origin || !allowed.has(origin)) throw new Status(HTTP.FORBIDDEN)
        response.writeHead(HTTP.NO_CONTENT, PREFLIGHT).end()
        status = HTTP.NO_CONTENT
        return
      }
      who = await dispatch(request, response, path)
      status = response.statusCode
    } catch (error) {
      status = Number.isInteger(error.status)
        ? error.status
        : HTTP.INTERNAL_ERROR
      if (status === HTTP.INTERNAL_ERROR)
        log(hash_phones(`error ${error.stack ?? error}`))
      if (!response.headersSent)
        response.writeHead(status, { 'cache-control': 'no-store' }).end()
      else response.destroy()
    } finally {
      if (!(status === HTTP.OK && routine(request.method, path)))
        log(hash_phones(request_line(who, request, path, status, started)))
    }
  })
}
