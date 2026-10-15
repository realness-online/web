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
  issue_host_pass,
  verify_host_pass,
  verify_record_pass,
  record_host
} from '#root/src/sign-on/node/host-pass.js'
import { run_host_alerts } from './host-alerts.js'
import { host_health } from './host-watch.js'
import { site_request } from './sites.js'
import { read_changes, record_change } from './changes.js'
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
export const storage_pins = storage => {
  const known = new Map()
  return {
    async claim(phone, uid) {
      if (known.has(phone)) return known.get(phone)
      let pinned = uid
      try {
        await storage.put(`pins/${phone}`, uid, { if_version: null })
      } catch (error) {
        if (error.code !== 'conflict') throw error
        pinned = (await storage.get(`pins/${phone}`))?.body.toString('utf8')
      }
      if (pinned) known.set(phone, pinned)
      return pinned
    }
  }
}

class Status extends Error {
  constructor(status) {
    super(String(status))
    this.status = status
  }
}

const action_for = (method, path) =>
  ({
    GET: path.endsWith('/') || path === '' ? 'list' : 'get',
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

const PREFLIGHT = {
  'access-control-allow-methods': 'GET, PUT, DELETE, POST',
  'access-control-allow-headers':
    'authorization, content-type, if-match, if-none-match',
  'access-control-max-age': '600'
}

/**
 * A harness pass reaches only the owner's harness paths; a recovery pass is
 * read-only and stays in its own tree; a host pass is limited to its site;
 * everyone else goes through `can()`.
 */
const caller_allowed = ({ action, grants, path, who }) => {
  if (who?.harness) return harness_path(path, who.harness, who.paths)
  if (who?.recovery)
    return (
      ['get', 'list'].includes(action) &&
      recovery_path(path, who.recovery, who.paths)
    )
  if (who?.host)
    return (
      path.startsWith(`people/${who.phone}/work/site/`) &&
      can(who, action, path, grants)
    )
  return can(who, action, path, grants)
}

/** List a folder, or the change feed, or every file below it. */
const answer_list = async (storage, request, response, path) => {
  const query = new URLSearchParams((request.url ?? '').split('?')[1] ?? '')
  if (query.has('changes')) {
    const feed = await read_changes(storage, path, query.get('changes'))
    if (!feed) throw new Status(HTTP.GONE)
    response.writeHead(HTTP.OK, {
      'content-type': 'application/json',
      'cache-control': 'no-store'
    })
    return response.end(JSON.stringify(feed))
  }
  response.writeHead(HTTP.OK, { 'content-type': 'application/json' })
  let listing = storage.list(path)
  if (query.get('deep') === 'meta') listing = storage.walk_meta(path)
  else if (query.has('deep')) listing = storage.walk(path)
  return response.end(JSON.stringify(await listing))
}

/** Send one file with its version as the etag. */
const answer_get = async (storage, response, path) => {
  const file = await storage.get(path)
  if (!file) throw new Status(HTTP.NOT_FOUND)
  response.writeHead(HTTP.OK, {
    etag: `"${file.version}"`,
    'content-type': 'application/octet-stream'
  })
  return response.end(file.body)
}

/**
 * One log line per request, naming the caller's phone when the pass carries
 * one. Harness, recovery, and record passes log a dash.
 */
const request_line = (who, request, path, status, started) =>
  `${new Date().toISOString()} ${who && 'phone' in who ? who.phone : '-'} ${request.method} /${path ?? '(bad encoding)'} ${status} ${Date.now() - started}ms`

/** A host's record pass, checked against the key it registered. */
const record_identity = async (token, storage) => {
  try {
    const host = record_host(token)
    const key = await storage.get(`host-keys/${host}`)
    if (!key) throw new Status(HTTP.UNAUTHORIZED)
    return {
      host_name: verify_record_pass(token, key.body.toString('utf8').trim())
        .host
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

/** POST /v1/host-pass: a short-lived owner pass. */
const answer_host_pass = (response, who, host_pass_secret) => {
  if (!host_pass_secret) throw new Status(HTTP.UNAVAILABLE)
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(
    JSON.stringify({
      pass: issue_host_pass(who, host_pass_secret),
      expires_in: 300
    })
  )
}

/** The caller behind a `v1/sites/` request, if any; plain `sites/` is public. */
const site_caller = (path, request, host_pass_secret) => {
  if (!path.startsWith('v1/sites/')) return null
  const pass = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1]
  if (!pass || !host_pass_secret) throw new Status(HTTP.UNAUTHORIZED)
  try {
    return verify_host_pass(pass, host_pass_secret)
  } catch {
    throw new Status(HTTP.UNAUTHORIZED)
  }
}

/** POST /v1/host-watch/run: send the queued host alerts. */
const answer_host_alerts = async (
  request,
  response,
  { alert_call, alert_webhook, host_statuses, log, storage }
) => {
  if (!alert_call(request)) throw new Status(HTTP.UNAUTHORIZED)
  const sent = await run_host_alerts({
    storage,
    webhook: alert_webhook,
    statuses: host_statuses,
    warn: message => log(hash_phones(message))
  })
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(JSON.stringify({ sent }))
}

/** GET /hosts/quiet.json: the admin's host health report. */
const answer_quiet = async (
  response,
  who,
  { admins, host_statuses, storage }
) => {
  if (!(await admins.has(who.phone))) throw new Status(HTTP.FORBIDDEN)
  response.writeHead(HTTP.OK, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(
    JSON.stringify(await host_health(storage, { statuses: host_statuses }))
  )
}

/**
 * The sync service.
 * @param {object} options
 * @param {{ get: (key: string) => Promise<{ body: Buffer, version: string | null } | null>, put: (key: string, body: Buffer | string, options?: object) => Promise<string>, delete: (key: string, options?: object) => Promise<void>, list: (path: string) => Promise<{ files: string[], folders: string[] }>, walk: (path: string) => Promise<Record<string, string>>, walk_meta: (path: string) => Promise<Record<string, { version: string, size: number, updated: string }>> }} options.storage
 * @param {{ grants: (owner: string) => Promise<{ grants: object[] }>, forget: (owner: string) => void }} options.rights
 * @param {string} options.project
 * @param {() => Promise<Record<string, string>>} options.certs
 * @param {string | undefined} options.host_pass_secret enables the pass routes
 * @param {string | null} [options.alert_token]
 * @param {string | null} [options.alert_webhook]
 * @param {(() => Promise<Map<string, string>>) | null} [options.host_statuses] provider status per host name
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
  host_pass_secret,
  alert_token = null,
  alert_webhook = null,
  host_statuses = null,
  origins = [],
  git_app = null,
  git_fetch = fetch,
  log = console.info
}) => {
  const pins = storage_pins(storage)
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

  /** A host's record pass, checked against the key it registered. */
  const who_is = async request => {
    const header = request.headers.authorization
    if (!header) return null
    const token = /^Bearer (\S+)$/.exec(header)?.[1]
    if (!token) throw new Status(HTTP.UNAUTHORIZED)
    if (token.split('.').length === 2) {
      if (!host_pass_secret) throw new Status(HTTP.UNAUTHORIZED)
      try {
        const claims = verify_recovery_pass(token, host_pass_secret)
        return { recovery: claims.phone, id: claims.id, paths: claims.paths }
      } catch {
        try {
          const claims = verify_harness_pass(token, host_pass_secret)
          return { harness: claims.phone, id: claims.id, paths: claims.paths }
        } catch {
          try {
            return { ...verify_host_pass(token, host_pass_secret), host: true }
          } catch {
            return record_identity(token, storage)
          }
        }
      }
    }
    try {
      return await identify(token, { project, certs, pins })
    } catch {
      throw new Status(HTTP.UNAUTHORIZED)
    }
  }

  const admins = admin_list(storage)

  const handle = async (request, response, path, action, caller) => {
    const who =
      ['loops', 'hosts', 'usage', 'billing'].includes(path.split('/')[0]) &&
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

    const if_version =
      request.headers['if-none-match'] === '*'
        ? null
        : version_from(request.headers['if-match'])
    try {
      if (action === 'write') {
        const version = await storage.put(path, await read_body(request), {
          if_version
        })
        await record_change(storage, path, version)
        response.writeHead(HTTP.OK, { etag: `"${version}"` })
      } else {
        await storage.delete(path, { if_version })
        await record_change(storage, path, null)
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
    if (path.startsWith('sites/') || path.startsWith('v1/sites/')) {
      const who = site_caller(path, request, host_pass_secret)
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
    if (path === 'v1/host-watch/run' && method === 'POST') {
      await answer_host_alerts(request, response, {
        alert_call,
        alert_webhook,
        host_statuses,
        log,
        storage
      })
      return null
    }
    if (path === 'hosts/quiet.json' && method === 'GET') {
      const who = await who_is(request)
      if (!who?.phone) throw new Status(HTTP.UNAUTHORIZED)
      await answer_quiet(response, who, { admins, host_statuses, storage })
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
    if (path === 'v1/host-pass' && method === 'POST') {
      const who = await who_is(request)
      if (!who?.phone) throw new Status(HTTP.UNAUTHORIZED)
      answer_host_pass(response, who, host_pass_secret)
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
    /** @type {{ phone: string } | { host_name: string } | { recovery: string, id: string, paths: string[] | null } | { harness: string, id: string, paths: string[] | null } | null} */
    let who = null
    /** @type {number} */
    let status = HTTP.OK
    if (origin && allowed.has(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('access-control-expose-headers', 'etag')
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
      log(hash_phones(request_line(who, request, path, status, started)))
    }
  })
}
