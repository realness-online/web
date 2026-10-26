/**
 * The sync service over HTTP. Every request: phone token, then `can()`,
 * then storage, then one log line with phone numbers hashed.
 *
 *   GET    /people/+A/posters/     list a folder (trailing slash)
 *   GET    /people/+A/vault/?deep  every file below, name to version
 *   GET    /people/+A/?version=V   every file holding that version
 *   GET    /people/+A/index.html.gz
 *   PUT    /people/+A/vault/note.md   If-Match: "<version>" or If-None-Match: *
 *          Content-Encoding: gzip and X-Version: "<plain hash>" optional; a
 *          gzip body is unpacked as it streams in and checked against it
 *   DELETE /people/+A/vault/note.md   If-Match optional
 *
 * No token is a stranger; a bad token is 401. Denial is 403 whether or not
 * the file exists, because the check runs before storage is touched.
 *
 * Browsers may call it only from `origins`, the sites allowed to read and write.
 */
import { answer_release } from '#root/lib/release.js'
import {
  createHash as create_hash,
  timingSafeEqual as timing_safe_equal
} from 'node:crypto'
import { createServer as create_server } from 'node:http'
import {
  createGunzip as create_gunzip,
  gunzipSync as gunzip_sync
} from 'node:zlib'
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
import { skipped } from '#root/src/files/skip.js'
import { org_route, RouteStatus } from './org-routes.js'
import { members_key, orgs_of, read_org, read_org_along } from './orgs.js'
import { read_members } from '#root/src/can/members.js'
import { admins as admin_list } from './admins.js'
import { keeper } from './trash.js'
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

const VERSION_LENGTH = 22

/**
 * A write's body, hashed as it arrives: `X-Version` must match the plain
 * bytes' hash, which is `version_of` from src/files/version.js. A gzip body
 * is unpacked on the way to the hash and kept packed; its plain size counts
 * against the same limit.
 */
const read_write = async request => {
  const encoding = request.headers['content-encoding'] ?? 'identity'
  if (!['gzip', 'identity'].includes(encoding))
    throw new Status(HTTP.UNSUPPORTED_MEDIA_TYPE)
  const hash = create_hash('sha256')
  const gunzip = encoding === 'gzip' ? create_gunzip() : null
  gunzip?.on('error', () => {})
  const unpacked = gunzip && unpack(gunzip, hash)
  unpacked?.catch(() => {})
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Status(HTTP.PAYLOAD_TOO_LARGE)
    chunks.push(chunk)
    if (gunzip) gunzip.write(chunk)
    else hash.update(chunk)
  }
  if (gunzip) {
    gunzip.end()
    await unpacked
  }
  const claimed = version_from(request.headers['x-version'])
  if (claimed && claimed !== hash.digest('base64url').slice(0, VERSION_LENGTH))
    throw new Status(HTTP.BAD_REQUEST)
  return { body: Buffer.concat(chunks), packed: Boolean(gunzip) }
}

/** Feed unpacked bytes to the hash; bad gzip is a 400, a bomb a 413. */
const unpack = async (gunzip, hash) => {
  let size = 0
  try {
    for await (const chunk of gunzip) {
      size += chunk.length
      if (size > LIMIT) throw new Status(HTTP.PAYLOAD_TOO_LARGE)
      hash.update(chunk)
    }
  } catch (error) {
    gunzip.destroy()
    throw error instanceof Status ? error : new Status(HTTP.BAD_REQUEST)
  }
}

/**
 * The meta a write may carry, each as an `x-meta-*` header: what we know
 * about the data that its bytes cannot say. Anything else is refused.
 */
const META_HEADERS = {
  sold: 'x-meta-sold',
  fullLocale: 'x-meta-full-locale',
  created: 'x-meta-created'
}

/** `created` is an ISO time; storage keeps the earliest. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
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
  const created = headers[META_HEADERS.created]
  if (
    created !== undefined &&
    (!ISO_TIME.test(created) || Number.isNaN(Date.parse(created)))
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
  'access-control-allow-headers': `authorization, content-type, content-encoding, if-match, if-none-match, x-version, ${META_LIST}`,
  'access-control-max-age': '600'
}

/**
 * A harness pass reaches only the owner's harness paths; a recovery pass is
 * read-only and stays in its own tree; a halo pass is limited to its site;
 * everyone else goes through `can()`.
 */
/**
 * A harness reaches an org's files only while its owner is a member, with
 * the owner's rights, and never the members page. A pass limited to paths
 * names orgs as `orgs/+name` or deeper; one with no limit reaches every org
 * its owner is in.
 */
const harness_org_allowed = ({ action, org, path, who }) => {
  const rest = path.split('/').slice(2).join('/')
  if (rest.split('/').at(-1) === 'members.html' || skipped(rest)) return false
  const { paths } = who
  if (
    paths &&
    !paths.some(
      allowed =>
        allowed.startsWith('orgs/+') &&
        (path === allowed || path.startsWith(`${allowed}/`))
    )
  )
    return false
  return can({ phone: who.harness }, action, path, [], org)
}

const caller_allowed = ({ action, grants, org, path, who }) => {
  if (who?.harness && path.startsWith('orgs/'))
    return harness_org_allowed({ action, org, path, who })
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
  return can(who, action, path, grants, org)
}

/** A members page must read cleanly; the org's top page keeps the writer as founder. */
const check_members = (body, packed, who, top) => {
  try {
    const html = (packed ? gunzip_sync(body) : body).toString('utf8')
    const page = read_members(html)
    if (!top || page.founder === who?.phone) return
  } catch {
    // falls through to the refusal
  }
  throw new Status(HTTP.BAD_REQUEST)
}

/* eslint-disable no-await-in-loop -- each folder's lists are read once, then cached */
/**
 * sh3 in listings: under an org, drop what a narrower `members.html` keeps
 * from the caller, so a list never names a file they cannot read.
 */
const org_visible = async (storage, path, who, listing) => {
  if (!path.startsWith('orgs/') || !listing) return listing
  const reader = who?.harness ? { phone: who.harness } : who
  const seen = new Map()
  const allowed = async key => {
    const folder = key.slice(0, key.lastIndexOf('/') + 1)
    if (!seen.has(folder))
      seen.set(
        folder,
        read_org_along(storage, `${folder}x`).then(org =>
          can(reader, 'get', `${folder}x`, [], org)
        )
      )
    const hidden = who?.harness && key.endsWith('/members.html')
    return !hidden && (await seen.get(folder))
  }
  if (Array.isArray(listing.files) && Array.isArray(listing.folders)) {
    const folders = []
    for (const name of listing.folders)
      if (await allowed(`${path}${name.replace(/\/$/, '')}/x`))
        folders.push(name)
    return { ...listing, folders }
  }
  const kept = {}
  for (const [name, value] of Object.entries(listing))
    if (await allowed(`${path}${name}`)) kept[name] = value
  return kept
}

/** List a folder, or every file below it. */
const answer_list = async (storage, request, response, path, who) => {
  const query = new URLSearchParams((request.url ?? '').split('?')[1] ?? '')
  const version = query.get('version')
  if (version && !/^people\/[^/]+\/$/.test(path))
    throw new Status(HTTP.BAD_REQUEST)
  let listing = storage.list(path)
  if (version)
    listing = storage.find(path, version).then(keys => ({
      files: keys.map(key => key.slice(path.length))
    }))
  else if (query.get('deep') === 'meta') listing = storage.walk_meta(path)
  else if (query.has('deep')) listing = storage.walk(path)
  const visible = await org_visible(storage, path, who, await listing)
  response.writeHead(HTTP.OK, { 'content-type': 'application/json' })
  return response.end(JSON.stringify(visible))
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
/**
 * sh6: publish copies one org file to `commons/+name/`, at the same place
 * below the org. The copy stays frozen until it is published again. A
 * person publishes; a harness, halo, or recovery pass never does.
 */
const answer_publish = async (request, response, who, storage) => {
  if (!who?.phone || who.halo || who.harness || who.recovery)
    throw new Status(HTTP.UNAUTHORIZED)
  let from
  try {
    from = JSON.parse((await read_body(request)).toString('utf8')).path
  } catch {
    throw new Status(HTTP.BAD_REQUEST)
  }
  const parts = typeof from === 'string' ? from.split('/') : []
  const [root, name, ...rest] = parts
  const inside = rest.join('/')
  if (root !== 'orgs' || !name || !inside || inside === 'members.html')
    throw new Status(HTTP.BAD_REQUEST)
  if (skipped(inside)) throw new Status(HTTP.FORBIDDEN)
  const to = `commons/${name}/${inside}`
  const org = await read_org(storage, name)
  if (!can(who, 'get', from, [], org) || !can(who, 'write', to, [], org))
    throw new Status(HTTP.FORBIDDEN)
  const file = await storage.get(from)
  if (!file) throw new Status(HTTP.NOT_FOUND)
  const version = await storage.put(to, file.body, { meta: file.meta ?? {} })
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    etag: `"${version}"`
  })
  response.end(JSON.stringify({ path: to, version }))
}

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

/** Cloud Scheduler presents a shared secret; nothing else calls this. */
const alert_caller = alert_token => request => {
  if (!alert_token) return false
  const given = Buffer.from(
    /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? ''
  )
  const wanted = Buffer.from(alert_token)
  return given.length === wanted.length && timing_safe_equal(given, wanted)
}

/** A signed-in person, not a halo, harness, or recovery pass. */
const person_only = who => {
  if (!who?.phone || who.halo || who.harness || who.recovery)
    throw new Status(HTTP.UNAUTHORIZED)
  return who
}

const answer_json = (response, value) => {
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify(value))
}

/** One org route: a JSON body in, a JSON answer out. */
const answer_org_call = async ({
  request,
  response,
  org_call,
  who,
  storage
}) => {
  let body = {}
  try {
    const text = (await read_body(request)).toString('utf8')
    body = text ? JSON.parse(text) : {}
  } catch {
    throw new Status(HTTP.BAD_REQUEST)
  }
  try {
    answer_json(
      response,
      await org_call.route({ storage, who, name: org_call.name, body })
    )
  } catch (error) {
    if (error instanceof RouteStatus) throw new Status(error.status)
    throw error
  }
}

/** A guarded write or delete of one record. */
const change_record = async ({
  storage,
  request,
  response,
  path,
  owner,
  action,
  who,
  keep
}) => {
  const if_absent = request.headers['if-none-match'] === '*'
  const if_version = version_from(request.headers['if-match'])
  try {
    if (action === 'write') {
      const meta = meta_from(request.headers)
      const { body, packed } = await read_write(request)
      await refuse_sold(storage, path, who)
      if (owner && path.startsWith('orgs/') && path.endsWith('/members.html'))
        check_members(body, packed, who, path === members_key(owner))
      const version = await storage.put(path, body, {
        ...(if_absent ? { if_absent } : { if_version }),
        ...(packed && { encoding: 'gzip' }),
        meta
      })
      response.writeHead(HTTP.OK, { etag: `"${version}"` })
    } else {
      await keep(path, if_version)
      await storage.delete(path, { if_version })
      response.writeHead(HTTP.NO_CONTENT)
    }
  } catch (error) {
    if (error.code === 'conflict') throw new Status(HTTP.PRECONDITION_FAILED)
    throw error
  }
}

/**
 * The sync service.
 * @param {object} options
 * @param {{ get: (key: string) => Promise<{ body: Buffer, version: string | null, meta?: Record<string, string> } | null>, put: (key: string, body: Buffer | string, options?: object) => Promise<string>, delete: (key: string, options?: object) => Promise<void>, list: (path: string) => Promise<{ files: string[], folders: string[] }>, walk: (path: string) => Promise<Record<string, string>>, walk_meta: (path: string) => Promise<Record<string, { version: string, size: number, updated: string }>>, find: (scope: string, version: string) => Promise<string[]> }} options.storage
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

  const alert_call = alert_caller(alert_token)

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
  const keep = keeper(storage)

  const handle = async (request, response, path, action, caller) => {
    const who =
      ['loops', 'halos', 'usage', 'billing', 'orgs'].includes(
        path.split('/')[0]
      ) && caller?.phone
        ? { ...caller, admin: await admins.has(caller.phone) }
        : caller
    const [, owner] = path.split('/')
    const grants =
      who?.instance && owner ? (await rights.grants(owner)).grants : []
    /** @type {{ founder: string | null, members: string[] } | null} */
    let org = null
    if (owner && path.startsWith('orgs/'))
      org = await read_org_along(storage, path)
    else if (owner && path.startsWith('commons/'))
      org = await read_org(storage, owner)
    else if (path.startsWith('trash/orgs/+'))
      org = await read_org(storage, path.split('/')[2])
    if (!caller_allowed({ action, grants, org, path, who }))
      throw new Status(HTTP.FORBIDDEN)

    if (action === 'list')
      return await answer_list(storage, request, response, path, who)
    if (action === 'get') return await answer_get(storage, response, path)

    await change_record({
      storage,
      request,
      response,
      path,
      owner,
      action,
      who,
      keep
    })
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
    if (path === 'v1/orgs' && method === 'GET') {
      const who = person_only(await who_is(request))
      answer_json(response, { orgs: await orgs_of(storage, who.phone) })
      return who
    }
    const org_call = org_route(path, method)
    if (org_call) {
      const caller = person_only(await who_is(request))
      const who = { ...caller, admin: await admins.has(caller.phone) }
      await answer_org_call({ request, response, org_call, who, storage })
      return caller
    }
    if (path === 'v1/publish' && method === 'POST') {
      const who = await who_is(request)
      await answer_publish(request, response, who, storage)
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
    if (answer_release(request, response)) return
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
