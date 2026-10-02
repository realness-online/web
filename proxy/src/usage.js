// The ledger: one create-only file per model call, outside `people/` so
// only the proxy writes it; `can()` lets the owner read it.
//   usage/+A/<day>/<time>-<actor>-<nonce>.html
// Rows carry sizes, tokens, and cost; never prompt or reply text.
// b1a: each row names its payer (the phone billed) and how the call came:
// `actor` (the person's harness), `app` (a published app; its owner pays),
// or `phone` (a signed-in person directly). Older rows lack both; read_rows
// fills them from the folder's phone and the actor id.
// b1d: `plan` says which allowance paid: `free` (free model, counted in
// tokens) or `paid` (house model, counted in dollars). Older rows are free.
import { randomBytes } from "node:crypto"

const LIMIT = 10 * 1024 * 1024
const FIELDS = ["model", "actor", "payer", "via", "plan", "status", "request_bytes", "reply_bytes", "prompt_tokens", "completion_tokens", "cost"]
const NUMBERS = FIELDS.slice(5)

/** How a call came, from the caller's id. */
export const via_of = (actor) => (/^app-/.test(actor ?? "") ? "app" : /^a-/.test(actor ?? "") ? "actor" : "phone")

/** Watches a reply as it streams past; finish() returns its usage. */
export function usage_meter() {
  let pending = ""
  let bytes = 0
  let whole = "" // a non-streamed JSON reply, kept until parsed
  let found = null
  const read = (text) => {
    try {
      const data = JSON.parse(text)
      if (data?.usage) found = { ...data.usage, model: data.model }
    } catch {}
  }
  const decoder = new TextDecoder()
  return {
    add(chunk) {
      bytes += chunk.length
      const text = decoder.decode(chunk, { stream: true })
      if (whole.length + text.length <= LIMIT) whole += text
      pending += text
      const lines = pending.split("\n")
      pending = lines.pop()
      for (const line of lines) if (line.startsWith("data: ") && line.includes('"usage"')) read(line.slice(6))
    },
    finish() {
      if (pending.startsWith("data: ")) read(pending.slice(6))
      if (!found) read(whole)
      whole = pending = ""
      return { reply_bytes: bytes, usage: found }
    },
  }
}

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/** One call as an HTML Lines row. */
export function usage_row({ model, actor, payer, plan, status, request_bytes, reply_bytes, usage }) {
  const values = {
    model: usage?.model ?? model,
    actor,
    payer: payer ?? "",
    via: via_of(actor),
    plan: plan === "paid" ? "paid" : "free",
    status,
    request_bytes,
    reply_bytes,
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    cost: usage?.cost ?? 0,
  }
  const props = FIELDS.map((name) => `<meta itemprop="${name}" content="${escape(values[name])}">`).join("")
  return `<p itemscope itemtype="/usage">${props}</p>\n`
}

/** Reads rows back; unknown text is ignored. `payer` fills older rows. */
export function read_rows(html, payer = "") {
  const rows = []
  for (const [row] of html.matchAll(/<p itemscope itemtype="\/usage">.*?<\/p>/g)) {
    const values = {}
    for (const [, name, value] of row.matchAll(/itemprop="(\w+)" content="([^"]*)"/g)) values[name] = value
    for (const name of NUMBERS) values[name] = Number(values[name])
    values.payer ||= payer
    values.via ||= via_of(values.actor)
    values.plan ||= "free"
    rows.push(values)
  }
  return rows
}

export const usage_day = (phone, day) => `usage/${phone}/${day}/`

export function usage_key(phone, actor, now = new Date()) {
  const iso = now.toISOString()
  return `${usage_day(phone, iso.slice(0, 10))}${iso.slice(11).replace(/[:.]/g, "")}-${actor}-${randomBytes(3).toString("hex")}.html`
}

const today = (now = new Date()) => now.toISOString().slice(0, 10)

/** Every UTC day from `start` (YYYY-MM-DD) through `now`'s day. */
export function days_since(start, now = new Date()) {
  const days = []
  const end = today(now)
  for (let at = new Date(`${start}T00:00:00Z`); at.toISOString().slice(0, 10) <= end; at.setUTCDate(at.getUTCDate() + 1)) days.push(at.toISOString().slice(0, 10))
  return days
}

/** Every UTC day of `now`'s month, up to and including today. */
export const month_days = (now = new Date()) => days_since(`${today(now).slice(0, 8)}01`, now)

const add = (a, b) => ({ tokens: a.tokens + b.tokens, cost: a.cost + b.cost })
const KEEP_DAYS = 62 // a paid period can start last month

/** A zero-price upstream model, e.g. "thinkingmachines/inkling:free". */
export const free_model = (model) => typeof model === "string" && model.endsWith(":free")

/** Tokens a row spends of the free limit: free plan, priced model only. */
const free_tokens = (row) => (row.plan === "paid" || free_model(row.model) ? 0 : row.prompt_tokens + row.completion_tokens)

/** Free-plan tokens and all cost; paid rows and free models spend none. */
export function sum_rows(rows) {
  return {
    tokens: rows.reduce((sum, row) => sum + free_tokens(row), 0),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
  }
}

/**
 * Storage-backed ledger for the proxy. Each day folder is read once, then
 * counted in memory; each proxy instance keeps its own count.
 */
export function usage_ledger(storage) {
  const totals = new Map() // `${phone} ${day}` -> Promise<{ tokens, cost }>
  const total = (phone, day) => {
    const key = `${phone} ${day}`
    if (!totals.has(key)) {
      const read = ledger.day(phone, day).then(({ rows }) => sum_rows(rows))
      read.catch(() => totals.delete(key))
      totals.set(key, read)
    }
    return totals.get(key)
  }
  const forget = (now) => {
    const oldest = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
    for (const key of totals.keys()) if (key.slice(-10) < oldest) totals.delete(key)
  }
  const ledger = {
    /** `{ day, month }`, each `{ tokens, cost }`, in UTC. */
    async spent(phone, now = new Date()) {
      forget(now)
      const sums = await Promise.all(month_days(now).map((day) => total(phone, day)))
      return { day: { ...sums.at(-1) }, month: sums.reduce(add, { tokens: 0, cost: 0 }) }
    },
    /** `{ tokens, cost }` from `start` (YYYY-MM-DD) through today. */
    async spent_since(phone, start, now = new Date()) {
      forget(now)
      const sums = await Promise.all(days_since(start, now).map((day) => total(phone, day)))
      return sums.reduce(add, { tokens: 0, cost: 0 })
    },
    async record(phone, row, now = new Date()) {
      const version = await storage.put(usage_key(phone, row.actor, now), usage_row(row), { if_version: null })
      const key = `${phone} ${today(now)}`
      if (totals.has(key)) {
        const sum = await totals.get(key).catch(() => null)
        if (sum) {
          sum.tokens += free_tokens({ plan: row.plan, model: row.usage?.model ?? row.model, prompt_tokens: row.usage?.prompt_tokens ?? 0, completion_tokens: row.usage?.completion_tokens ?? 0 })
          sum.cost += row.usage?.cost ?? 0
        }
      }
      return version
    },
    async day(phone, day) {
      const folder = usage_day(phone, day)
      const { files } = await storage.list(folder)
      const pages = await Promise.all(files.map((name) => storage.get(folder + name)))
      const rows = pages.flatMap((page) => (page ? read_rows(page.body.toString("utf8"), phone) : []))
      return { rows, cost: rows.reduce((sum, row) => sum + row.cost, 0) }
    },
  }
  return ledger
}

/** Free use runs a free model, so its limits count tokens. */
export const FREE_LIMITS = { day: { tokens: 250_000 }, month: { tokens: 3_000_000 } }

/** Free limits after env overrides; "Infinity" lifts one. */
export function free_limits(env = {}) {
  const pick = (name, fallback = Infinity) => (env[name] ? Number(env[name]) : fallback)
  return {
    day: { tokens: pick("FREE_TOKENS_PER_DAY", FREE_LIMITS.day.tokens), cost: pick("FREE_COST_PER_DAY") },
    month: { tokens: pick("FREE_TOKENS_PER_MONTH", FREE_LIMITS.month.tokens), cost: pick("FREE_COST_PER_MONTH") },
  }
}

/**
 * Which limit is spent: "day", "month", or null. Limits are `{ day, month }`,
 * each `{ tokens, cost }`; a missing limit is no limit. Paid plans (b1d) pass
 * their own limits through the same check.
 */
export function over_limit(spent, limits = {}) {
  const over = (used, { tokens = Infinity, cost = Infinity } = {}) => used.tokens >= tokens || used.cost >= cost
  if (over(spent.month, limits.month)) return "month"
  if (over(spent.day, limits.day)) return "day"
  return null
}
