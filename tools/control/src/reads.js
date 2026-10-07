// o4 operator reads. Every answer comes from records in sync,
// so a stopped host still answers with its last report.
import { client } from "#root/lib/files/src/client.js"
import { token_source } from "#root/lib/sign-on/src/node/login.js"
import { read_status } from "#root/server/sync/src/host-status.js"
import { day_files, days_since, free_limits, month_days, read_rows, sum_rows } from "#root/server/proxy/src/usage.js"
import { billing_key, limit_status, paid_now, read_plan } from "#root/server/proxy/src/billing.js"
import { URLS } from "./status.js"
import { randomUUID as random_uuid } from "node:crypto"
import { ACTOR_ACTIONS, request_html, request_key } from "#root/server/sync/src/actor-request.js"

const PHONE = /^\+[1-9]\d{6,14}$/
const LOOP = /^a-[a-f0-9]{12}$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const unesc = (value) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")

/** A signed-in sync client for one environment. */
export const reader = async (env, { url = URLS[env], token = token_source() } = {}) => {
  if (!url) throw new Error(`no sync URL for ${env}`)
  const bearer = await token()
  if (!bearer) throw new Error("not signed in; run webspace <env> admin login")
  return client({ url, token: bearer })
}

const folders = async (sync, path) => (await sync.ls(path)).filter((name) => name.endsWith("/")).map((name) => name.slice(0, -1))

/** Unmasked host records; output masks phones on the way out. */
export const hosts = async (sync, name, now = Date.now()) => {
  const names = name ? [name] : await folders(sync, "can://hosts/")
  const out = []
  for (const host_name of names) {
    if (!HOST.test(host_name)) throw new Error("invalid host name")
    const record = read_status((await sync.cat(`can://hosts/${host_name}/status.html`)).toString("utf8"))
    if (record.host?.name !== host_name || !Number.isFinite(Date.parse(record.host.checked))) throw new Error(`invalid status for ${host_name}`)
    out.push({ ...record, age_s: Math.max(0, Math.floor((now - Date.parse(record.host.checked)) / 1000)) })
  }
  return out
}

/** m7: sync's own verdict on which hosts have stopped reporting. */
export const quiet_hosts = async (sync) => {
  try {
    return JSON.parse((await sync.cat("can://hosts/quiet.json")).toString("utf8"))
  } catch (error) {
    // An older sync has no derived record; say so rather than reporting calm.
    if (error.status === 404) return { setup: "sync does not report host health yet" }
    throw error
  }
}

/** Every actor any host last reported, tagged with that host. */
export const actors = async (sync, id, now) => {
  const rows = (await hosts(sync, null, now)).flatMap(({ host, age_s, actors }) => actors.map((actor) => ({ ...actor, host: host.name, age_s })))
  if (!id) return rows
  const found = rows.filter((actor) => actor.id === id)
  if (!found.length) throw new Error(`no actor ${id}`)
  return found
}

export const read_loop = (html) => {
  const match = html.match(/<article itemscope itemtype="\/loop">(.*?)<\/article>/s)
  if (!match) return null
  const loop = {}
  for (const [, name, value] of match[1].matchAll(/itemprop="(\w+)" content="([^"]*)"/g)) loop[name] = unesc(value)
  const goal = match[1].match(/<p itemprop="goal">(.*?)<\/p>/s)
  loop.goal = goal ? unesc(goal[1]) : ""
  for (const name of ["depth", "runs", "tokens"]) if (loop[name] !== undefined && loop[name] !== "") loop[name] = Number(loop[name])
  return loop
}

export const loops = async (sync, id) => {
  if (id && !LOOP.test(id)) throw new Error("invalid loop id")
  const ids = id ? [id] : (await folders(sync, "can://loops/")).filter((name) => LOOP.test(name))
  const out = []
  for (const loop_id of ids) {
    const loop = read_loop((await sync.cat(`can://loops/${loop_id}/record.html`)).toString("utf8"))
    if (loop) out.push(loop)
  }
  return out.sort((a, b) => String(b.started).localeCompare(String(a.started)))
}

/** One person's ledger for one UTC day, with totals. */
export const usage = async (sync, phone, day = new Date().toISOString().slice(0, 10)) => {
  if (!PHONE.test(phone ?? "")) throw new Error("usage: webspace <env> usage <phone> [--day=YYYY-MM-DD]")
  if (!DAY.test(day)) throw new Error("day must be YYYY-MM-DD")
  let files = []
  try {
    files = day_files(await sync.ls(`can://usage/${phone}/${day}/`))
  } catch (error) {
    if (error.status !== 404) throw error
  }
  const pages = []
  for (const file of files) {
    // a piece can be composed and deleted between ls and cat
    const page = await sync.cat(`can://usage/${phone}/${day}/${file}`).catch((error) => { if (error.status !== 404) throw error })
    pages.push(page?.toString("utf8") ?? "")
  }
  const rows = read_rows([pages.at(-1) ?? "", ...pages.slice(0, -1)].join(""), phone) // index, then pieces
  const tokens = rows.reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0)
  const cost = rows.reduce((sum, row) => sum + row.cost, 0)
  return { phone, day, calls: rows.length, tokens, cost, rows }
}

/**
 * b1e: one person's limits, use, and what is left, today, this month, and in
 * a paid period. The same status the proxy gives the person, warning included.
 */
export const limit = async (sync, phone, now = new Date()) => {
  if (!PHONE.test(phone ?? "")) throw new Error("usage: webspace <env> limit <phone>")
  const missing = (error) => { if (error.status !== 404) throw error }
  const days = await sync.ls(`can://usage/${phone}/`).catch((error) => (missing(error), []))
  const record = await sync.cat(`can://${billing_key(phone)}`).catch((error) => (missing(error), null))
  const paid = paid_now(record ? read_plan(record.toString("utf8")) : null, now)
  const month = month_days(now)
  const wanted = [...new Set([...(paid ? days_since(paid.start, now) : []), ...month])].filter((day) => days.includes(day) || days.includes(`${day}/`))
  const rows = new Map(await Promise.all(wanted.map(async (day) => [day, (await usage(sync, phone, day)).rows])))
  const total = (list) => sum_rows(list.flatMap((day) => rows.get(day) ?? []))
  const spent = { day: total([month.at(-1)]), month: total(month), period: paid ? total(days_since(paid.start, now)) : { tokens: 0, cost: 0 } }
  return { phone, ...limit_status({ free: free_limits(), paid }, spent) }
}

/** What an admin may see of one person: actors, loops, today's usage. */
export const person = async (sync, phone, { day, now } = {}) => {
  if (!PHONE.test(phone ?? "")) throw new Error("usage: webspace <env> person <phone>")
  const [all_actors, all_loops, spent] = await Promise.all([actors(sync, null, now), loops(sync), usage(sync, phone, day)])
  const { rows, ...totals } = spent
  return {
    phone,
    actors: all_actors.filter((actor) => actor.owner === phone),
    loops: all_loops.filter((loop) => loop.owner === phone),
    usage: totals,
  }
}

const table = (rows, line) => rows.length ? rows.map(line).join("\n") : "none"

export const text = {
  actors: (rows) => table(rows, (a) => `${a.id}  ${a.host}  owner ${a.owner || "-"}  ${a.state ?? a.status ?? ""}`.trimEnd()),
  loops: (rows) => table(rows, (l) => `${l.id}  ${l.status}  ${l.runs ?? 0} runs  ${l.tokens ?? 0} tokens  owner ${l.owner || "-"}  ${l.goal.slice(0, 60)}`),
  usage: (u) => `${u.phone} ${u.day}: ${u.calls} calls, ${u.tokens} tokens, $${u.cost.toFixed(4)}`,
  limit: (l) => {
    const n = (value) => (value == null ? "no limit" : value.toLocaleString("en-US"))
    const line = (name, part) => `${name}: ${n(part.used)} of ${n(part.limit)} free tokens (${part.percent ?? 0}%), ${n(part.left)} left`
    const lines = [`${l.phone} on ${l.plan}`, line("today", l.free.day), line("month", l.free.month)]
    if (l.paid) lines.push(`credit: $${l.paid.used.toFixed(2)} of $${l.paid.credit.toFixed(2)} (${l.paid.percent ?? 0}%), ${l.paid.renews ? `renews ${l.paid.renews.slice(0, 10)}` : `ends ${l.paid.ends.slice(0, 10)}`}`)
    if (l.warn) lines.push(`warning: ${l.warn.message}`)
    return lines.join("\n")
  },
  person: (p) => [`${p.phone}`, `actors: ${p.actors.length}`, `loops: ${p.loops.length}`, `usage: ${text.usage(p.usage)}`].join("\n"),
}

// o6 writes: requests in Storage; hosts obey on their next pass.

/** Ask the actor's host to idle or stop it; returns the request. */
export const request_actor = async (sync, id, action, now = Date.now()) => {
  if (!ACTOR_ACTIONS.has(action)) throw new Error(`usage: webspace <env> actor idle|stop <id>`)
  const [actor] = await actors(sync, id, now)
  if (actor.state === "stopped" || (action === "idle" && actor.state === "idle")) return { id, host: actor.host, action, already: actor.state }
  const request = { id: random_uuid(), action, requested: new Date(now).toISOString() }
  await sync.put(`can://${request_key(actor.host, id)}`, Buffer.from(request_html(request)))
  return { id, host: actor.host, action, request: request.id, obeyed: "on the host's next pass, within a minute" }
}

/** Ask a running loop to stop; the host checks on its next probe. */
export const request_loop_stop = async (sync, id) => {
  const [loop] = await loops(sync, id)
  if (!loop) throw new Error(`no loop ${id}`)
  if (loop.status !== "running" && loop.status !== "starting") return { id, already: loop.status }
  await sync.put(`can://loops/${id}/stop.html`, Buffer.from(`<p>stop requested ${new Date().toISOString()}</p>\n`))
  return { id, action: "stop", obeyed: "on the host's next probe" }
}
