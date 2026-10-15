import { phone_of } from '#root/src/files/client.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
import {
  host_state as lifecycle_state,
  read_lifecycle
} from '#root/src/sync/host-lifecycle.js'
/* eslint-disable no-await-in-loop -- reads are paced one at a time to keep the sync service quiet */

const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/**
 * One host record as `{ host, actors, apps }`; unknown fields are ignored.
 * @typedef {Record<string, string>} StatusFields
 * @returns {{ host: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }}
 */
export const read_status = html => {
  /** @type {{ host: StatusFields | null, actors: StatusFields[], apps: StatusFields[] }} */
  const read = { host: null, actors: [], apps: [] }
  for (const [, type, body] of html.matchAll(
    /<article itemscope itemtype="\/(host|actor|app)">(.*?)<\/article>/g
  )) {
    const values = {}
    for (const [, name, value] of body.matchAll(
      /itemprop="(\w+)" content="([^"]*)"/g
    ))
      values[name] = unesc(value)
    if (type === 'host') read.host = values
    else read[`${type}s`].push(values)
  }
  return read
}

const QUIET_AFTER_MS = 120_000

const number = value => (Number.isFinite(Number(value)) ? Number(value) : null)

/**
 * The people an operator watches. With no named person, the token's own phone
 * is the one person this harness can read.
 */
export const people_for = (who, named = []) =>
  named.length ? named : [who?.phone].filter(Boolean)

/** A host's state word from its age and actor counts, busiest first. */
const host_state = ({ quiet, running, idle, stopped }) => {
  if (quiet) return 'quiet'
  if (running > 0) return 'running'
  if (idle > 0) return 'idle'
  if (stopped > 0) return 'sleeping'
  return 'unknown'
}

/** One `{ status, at }` result per read, so a failure shows its own age. */
/**
 * Panels may be sync or async; awaiting a plain value is the same thing.
 * @template T
 * @param {() => Promise<T> | T} read
 * @param {() => string} [at]
 * @returns {Promise<T | { status: string, error: string, at: string }>}
 */
const attempt = async (read, at = () => new Date().toISOString()) => {
  try {
    return { ...(await read()), status: 'ok', at: at() }
  } catch (error) {
    return { status: 'failed', error: error.message, at: at() }
  }
}

/** Host records: running, sleeping, or quiet, from the stored record's age. */
const hosts_panel = async ({ store, now = Date.now(), quiet_ms }) => {
  const listed = await store.ls('can://hosts/')
  const names = listed
    .filter(name => name.endsWith('/'))
    .map(name => name.slice(0, -1))
  const rows = []
  for (const name of names) {
    const page = await store
      .cat(`can://hosts/${name}/status.html`)
      .catch(() => null)
    const values = page ? (read_status(page.toString('utf8')).host ?? {}) : null
    const life = await store
      .cat(`can://hosts/${name}/lifecycle.html`)
      .catch(() => null)
    const planned = lifecycle_state({
      lifecycle: life ? read_lifecycle(life.toString('utf8')) : null,
      checked: values?.checked ?? '',
      now,
      quiet_ms
    })
    const at = Date.parse(values?.checked ?? '')
    if (
      planned === 'parked' ||
      planned === 'starting' ||
      planned === 'stopping'
    ) {
      rows.push({
        name,
        state: planned,
        age_s: Number.isFinite(at)
          ? Math.max(0, Math.floor((now - at) / MS_PER_SECOND))
          : null,
        detail: null
      })
      continue
    }
    if (!values || !Number.isFinite(at)) {
      rows.push({
        name,
        state: 'quiet',
        age_s: null,
        detail: values ? 'unreadable timestamp' : 'no record'
      })
      continue
    }
    const age_s = Math.max(0, Math.floor((now - at) / MS_PER_SECOND))
    const quiet = age_s * MS_PER_SECOND > quiet_ms
    const running = number(values.actors_running) ?? 0
    const idle = number(values.actors_idle) ?? 0
    const stopped = number(values.actors_stopped) ?? 0
    const state = host_state({ quiet, running, idle, stopped })
    rows.push({
      name,
      state,
      age_s,
      checked: values.checked,
      actors: { running, idle, stopped },
      loops: number(values.loops_running),
      apps: number(values.apps),
      mem_free: number(values.mem_available) ?? number(values.mem_free),
      volume_free: number(values.volume_free),
      detail: quiet ? `quiet for ${age_s}s` : null,
      errors: values.resource_error ? [values.resource_error] : []
    })
  }
  return { rows, names }
}

/** Model spend: the operator's own ledger, read the way the proxy writes it. */
/**
 * @typedef {{ tokens: number, cost: number }} SpendSum
 * @typedef {{ day: SpendSum, month: SpendSum, daily: SpendSum[] }} Spend
 *
 * @param {object} options
 * @param {object} options.store
 * @param {string[]} options.people
 * @param {{ spent: (phone: string) => Promise<Spend> }} options.ledger
 * @param {string[]} [options.named]
 */
const cost_panel = async ({ store, people, ledger, named = [] }) => {
  const rows = []
  for (const phone of people) {
    const spent = await ledger.spent(phone)
    rows.push({
      phone,
      day: spent.day,
      month: spent.month,
      daily: spent.daily ?? [],
      named: named.includes(phone)
    })
  }
  return { rows }
}

/** Sync: the change feed, plus what the last `realness sync` in this harness did. */
const sync_panel = async ({ store, who, records = {} }) => {
  const saved = Object.keys(records)
  const folders = saved.length
    ? [...new Set(saved)]
    : ['can://~/harness/', 'can://~/.pi/agent/sessions/']
  const rows = []
  for (const folder of folders) {
    const listed = await store.ls(folder).catch(() => null)
    const feed =
      typeof store.changes === 'function'
        ? await store.changes(folder).catch(() => null)
        : null
    const record = records[folder] ?? null
    rows.push({
      folder: folder.replace('can://~/', ''),
      files: listed ? undefined : null,
      listing: Boolean(listed),
      cursor: feed?.cursor ?? null,
      changes: feed ? Object.keys(feed.changes).length : null,
      last_sync: record?.at ?? null,
      state: (record && 'running') || (listed && 'idle') || 'quiet'
    })
  }
  return { rows, who: who?.phone ?? null }
}

/** Sign-on: whether a token exists and what it names. No call of its own. */
const sign_on_panel = ({ who, service }) => {
  if (!who?.phone)
    return {
      rows: [],
      state: 'unknown',
      detail: 'no token; run realness login'
    }
  return {
    rows: [
      {
        phone: who.phone,
        expires_at: who.exp
          ? new Date(who.exp * MS_PER_SECOND).toISOString()
          : null
      }
    ],
    state: 'running',
    detail: service ?? null
  }
}

/** Publishing: what each person has under `sites/`. */
const publish_panel = async ({ store, people }) => {
  const rows = []
  for (const phone of people) {
    const listed = await store.ls(`can://sites/${phone}/`).catch(() => null)
    rows.push({
      phone,
      sites: listed ? listed.filter(name => name.endsWith('/')).length : null,
      state: listed ? 'running' : 'unknown',
      detail: listed ? null : 'no site folder'
    })
  }
  return { rows }
}

/**
 * One health snapshot. `now` and `at` are injectable so the shape is tested
 * without a clock. A panel failure leaves the other panels usable.
 * @param {object} options
 * @param {object} options.store
 * @param {string | null} [options.token]
 * @param {{ spent: (phone: string) => Promise<Spend> }} options.ledger
 * @param {string[]} [options.named]
 * @param {object} [options.records]
 * @param {string | null} [options.service]
 * @param {number} [options.quiet_ms]
 * @param {number} [options.now]
 * @param {() => string} [options.at]
 * @param {{ billing: () => Promise<object>, services: () => Promise<object>, resources?: () => Promise<object> } | null} [options.cloud]
 */
export const health_snapshot = async ({
  store,
  token = null,
  ledger,
  named = [],
  records = {},
  service = null,
  quiet_ms = QUIET_AFTER_MS,
  now = Date.now(),
  at = () => new Date(now).toISOString(),
  cloud = null
}) => {
  const who = who_from(token)
  const people = people_for(who, named)
  const panels = /** @type {Record<string, unknown>} */ ({
    hosts: await attempt(() => hosts_panel({ store, now, quiet_ms }), at),
    cost: await attempt(() => cost_panel({ store, people, ledger, named }), at),
    sync: await attempt(() => sync_panel({ store, who, records }), at),
    sign_on: await attempt(() => sign_on_panel({ who, service }), at),
    publish: await attempt(() => publish_panel({ store, people }), at)
  })
  const [billing, services, resources] = await Promise.all([
    attempt(
      () =>
        cloud
          ? cloud.billing()
          : Promise.reject(new Error('cloud billing unavailable')),
      at
    ),
    attempt(
      () =>
        cloud
          ? cloud.services()
          : Promise.reject(new Error('cloud service status unavailable')),
      at
    ),
    attempt(
      () =>
        cloud?.resources
          ? cloud.resources()
          : Promise.reject(new Error('cloud machine status unavailable')),
      at
    )
  ])
  panels.billing = billing
  panels.services = services
  panels.resources = resources
  return { checked: new Date(now).toISOString(), who, people, panels }
}

/** The claims a token carries, locally, with no request. Null when unusable. */
export const who_from = token => {
  const phone = phone_of(token)
  if (!phone) return null
  let claims = {}
  try {
    claims = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    )
  } catch {
    claims = {}
  }
  return { phone, exp: number(claims.exp) }
}
