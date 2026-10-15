import { client } from '#root/src/files/client.js'
import { read_status } from '#root/src/sync/host-status.js'
import {
  intent_now,
  lifecycle_html,
  lifecycle_key
} from '#root/src/sync/host-lifecycle.js'
import {
  day_files,
  days_since,
  free_limits,
  month_days,
  read_rows,
  sum_rows
} from '#root/src/proxy/usage.js'
import {
  billing_key,
  limit_status,
  paid_now,
  read_plan
} from '#root/src/proxy/billing.js'
import { env_token, URLS } from './status.js'
import { randomUUID as random_uuid } from 'node:crypto'
import {
  ACTOR_ACTIONS,
  request_html,
  request_key
} from '#root/src/sync/actor-request.js'
import { HTTP } from '#root/lib/http.js'
import { ISO_DATE, MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- records are read one at a time to keep the sync service quiet */

const MONEY_PLACES = 4

const PHONE = /^\+[1-9]\d{6,14}$/
const LOOP = /^a-[a-f0-9]{12}$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const unesc = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/** A signed-in sync client for one environment. */
export const reader = async (
  env,
  { url = URLS[env], token = env_token(env) } = {}
) => {
  if (!url) throw new Error(`no sync URL for ${env}`)
  const bearer = await token()
  if (!bearer) throw new Error('not signed in; run realness <env> admin login')
  return client({ url, token: bearer })
}

const folders = async (sync, path) =>
  (await sync.ls(path))
    .filter(name => name.endsWith('/'))
    .map(name => name.slice(0, -1))

/** Unmasked host records; output masks phones on the way out. */
export const hosts = async (sync, name, now = Date.now()) => {
  const names = name ? [name] : await folders(sync, 'can://hosts/')
  const out = []
  for (const host_name of names) {
    if (!HOST.test(host_name)) throw new Error('invalid host name')
    const record = read_status(
      (await sync.cat(`can://hosts/${host_name}/status.html`)).toString('utf8')
    )
    const { host } = record
    if (
      !host ||
      host.name !== host_name ||
      !Number.isFinite(Date.parse(host.checked))
    )
      throw new Error(`invalid status for ${host_name}`)
    out.push({
      ...record,
      age_s: Math.max(
        0,
        Math.floor((now - Date.parse(host.checked)) / MS_PER_SECOND)
      )
    })
  }
  return out
}

/** m7: sync's own verdict on which hosts have stopped reporting. */
export const quiet_hosts = async sync => {
  try {
    return JSON.parse(
      (await sync.cat('can://hosts/quiet.json')).toString('utf8')
    )
  } catch (error) {
    if (error.status === HTTP.NOT_FOUND)
      return { setup: 'sync does not report host health yet' }
    throw error
  }
}

/** Every actor any host last reported, tagged with that host. */
export const actors = async (sync, id, now) => {
  const rows = (await hosts(sync, null, now)).flatMap(
    ({ host, age_s, actors }) =>
      actors.map(actor => ({ ...actor, host: host.name, age_s }))
  )
  if (!id) return rows
  const found = rows.filter(actor => actor.id === id)
  if (!found.length) throw new Error(`no actor ${id}`)
  return found
}

const read_loop = html => {
  const match = html.match(
    /<article itemscope itemtype="\/loop">(.*?)<\/article>/s
  )
  if (!match) return null
  const loop = {}
  for (const [, name, value] of match[1].matchAll(
    /itemprop="(\w+)" content="([^"]*)"/g
  ))
    loop[name] = unesc(value)
  const goal = match[1].match(/<p itemprop="goal">(.*?)<\/p>/s)
  loop.goal = goal ? unesc(goal[1]) : ''
  for (const name of ['depth', 'runs', 'tokens'])
    if (loop[name] !== undefined && loop[name] !== '')
      loop[name] = Number(loop[name])
  return loop
}

export const loops = async (sync, id) => {
  if (id && !LOOP.test(id)) throw new Error('invalid loop id')
  const ids = id
    ? [id]
    : (await folders(sync, 'can://loops/')).filter(name => LOOP.test(name))
  const out = []
  for (const loop_id of ids) {
    const loop = read_loop(
      (await sync.cat(`can://loops/${loop_id}/record.html`)).toString('utf8')
    )
    if (loop) out.push(loop)
  }
  return out.sort((a, b) => String(b.started).localeCompare(String(a.started)))
}

/** One person's ledger for one UTC day, with totals. */
export const usage = async (
  sync,
  phone,
  day = new Date().toISOString().slice(0, ISO_DATE)
) => {
  if (!PHONE.test(phone ?? ''))
    throw new Error('usage: realness <env> usage <phone> [--day=YYYY-MM-DD]')
  if (!DAY.test(day)) throw new Error('day must be YYYY-MM-DD')
  let files = []
  try {
    files = day_files(await sync.ls(`can://usage/${phone}/${day}/`))
  } catch (error) {
    if (error.status !== HTTP.NOT_FOUND) throw error
  }
  const pages = []
  for (const file of files) {
    const page = await sync
      .cat(`can://usage/${phone}/${day}/${file}`)
      .catch(error => {
        if (error.status !== HTTP.NOT_FOUND) throw error
      })
    pages.push(page?.toString('utf8') ?? '')
  }
  const rows = read_rows(
    [pages.at(-1) ?? '', ...pages.slice(0, -1)].join(''),
    phone
  )
  const tokens = rows.reduce(
    (sum, row) => sum + row.prompt_tokens + row.completion_tokens,
    0
  )
  const cost = rows.reduce((sum, row) => sum + row.cost, 0)
  return { phone, day, calls: rows.length, tokens, cost, rows }
}

/**
 * b1e: one person's limits, use, and what is left, today, this month, and in
 * a paid period. The same status the proxy gives the person, warning included.
 */
export const limit = async (sync, phone, now = new Date()) => {
  if (!PHONE.test(phone ?? ''))
    throw new Error('usage: realness <env> limit <phone>')
  const missing = error => {
    if (error.status !== HTTP.NOT_FOUND) throw error
  }
  const days = await sync
    .ls(`can://usage/${phone}/`)
    .catch(error => (missing(error), []))
  const record = await sync
    .cat(`can://${billing_key(phone)}`)
    .catch(error => (missing(error), null))
  const paid = paid_now(record ? read_plan(record.toString('utf8')) : null, now)
  const month = month_days(now)
  const wanted = [
    ...new Set([...(paid ? days_since(paid.start, now) : []), ...month])
  ].filter(day => days.includes(day) || days.includes(`${day}/`))
  const rows = new Map(
    await Promise.all(
      wanted.map(async day => /** @type {[string, object[]]} */ ([
        day,
        (await usage(sync, phone, day)).rows
      ]))
    )
  )
  const total = list => sum_rows(list.flatMap(day => rows.get(day) ?? []))
  const spent = {
    day: total([month.at(-1)]),
    month: total(month),
    period: paid ? total(days_since(paid.start, now)) : { tokens: 0, cost: 0 }
  }
  return { phone, ...limit_status({ free: free_limits(), paid }, spent) }
}

/**
 * What an admin may see of one person: actors, loops, today's usage.
 * @param {object} sync
 * @param {string} phone
 * @param {{ day?: string, now?: number }} [options]
 */
export const person = async (sync, phone, { day, now } = {}) => {
  if (!PHONE.test(phone ?? ''))
    throw new Error('usage: realness <env> person <phone>')
  const [all_actors, all_loops, spent] = await Promise.all([
    actors(sync, null, now),
    loops(sync),
    usage(sync, phone, day)
  ])
  const totals = {
    phone: spent.phone,
    day: spent.day,
    calls: spent.calls,
    tokens: spent.tokens,
    cost: spent.cost
  }
  return {
    phone,
    actors: all_actors.filter(actor => actor.owner === phone),
    loops: all_loops.filter(loop => loop.owner === phone),
    usage: totals
  }
}

const table = (rows, line) => (rows.length ? rows.map(line).join('\n') : 'none')

export const text = {
  actors: rows =>
    table(rows, a =>
      `${a.id}  ${a.host}  owner ${a.owner || '-'}  ${a.state ?? a.status ?? ''}`.trimEnd()
    ),
  loops: rows =>
    table(
      rows,
      l =>
        `${l.id}  ${l.status}  ${l.runs ?? 0} runs  ${l.tokens ?? 0} tokens  owner ${l.owner || '-'}  ${l.goal.slice(0, 60)}`
    ),
  usage: u =>
    `${u.phone} ${u.day}: ${u.calls} calls, ${u.tokens} tokens, $${u.cost.toFixed(MONEY_PLACES)}`,
  limit: l => {
    const n = value =>
      value === null || value === undefined
        ? 'no limit'
        : value.toLocaleString('en-US')
    const line = (name, part) =>
      `${name}: ${n(part.used)} of ${n(part.limit)} free tokens (${part.percent ?? 0}%), ${n(part.left)} left`
    const lines = [
      `${l.phone} on ${l.plan}`,
      line('today', l.free.day),
      line('month', l.free.month)
    ]
    if (l.paid)
      lines.push(
        `credit: $${l.paid.used.toFixed(2)} of $${l.paid.credit.toFixed(2)} (${l.paid.percent ?? 0}%), ${l.paid.renews ? `renews ${l.paid.renews.slice(0, ISO_DATE)}` : `ends ${l.paid.ends.slice(0, ISO_DATE)}`}`
      )
    if (l.warn) lines.push(`warning: ${l.warn.message}`)
    return lines.join('\n')
  },
  person: p =>
    [
      `${p.phone}`,
      `actors: ${p.actors.length}`,
      `loops: ${p.loops.length}`,
      `usage: ${text.usage(p.usage)}`
    ].join('\n')
}

/** Ask the actor's host to idle or stop it; returns the request. */
export const request_actor = async (sync, id, action, now = Date.now()) => {
  if (!ACTOR_ACTIONS.has(action))
    throw new Error(`usage: realness <env> actor idle|stop <id>`)
  const [actor] = await actors(sync, id, now)
  if (
    actor.state === 'stopped' ||
    (action === 'idle' && actor.state === 'idle')
  )
    return { id, host: actor.host, action, already: actor.state }
  const request = {
    id: random_uuid(),
    action,
    requested: new Date(now).toISOString()
  }
  await sync.put(
    `can://${request_key(actor.host, id)}`,
    Buffer.from(request_html(request))
  )
  return {
    id,
    host: actor.host,
    action,
    request: request.id,
    obeyed: "on the host's next pass, within a minute"
  }
}

/** Ask a running loop to stop; the host checks on its next probe. */
export const request_loop_stop = async (sync, id) => {
  const [loop] = await loops(sync, id)
  if (!loop) throw new Error(`no loop ${id}`)
  if (loop.status !== 'running' && loop.status !== 'starting')
    return { id, already: loop.status }
  await sync.put(
    `can://loops/${id}/stop.html`,
    Buffer.from(`<p>stop requested ${new Date().toISOString()}</p>\n`)
  )
  return { id, action: 'stop', obeyed: "on the host's next probe" }
}

/** Record what the operator is doing to a host, so monitors can tell parking from failure. */
export const record_intent = async (sync, name, intent, options = {}) => {
  if (!HOST.test(name)) throw new Error('invalid host name')
  const record = intent_now(intent, { by: 'operator', ...options })
  await sync.put(
    `can://${lifecycle_key(name)}`,
    Buffer.from(lifecycle_html(record))
  )
  return record
}
