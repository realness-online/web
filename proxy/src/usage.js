// The ledger: one create-only file per model call, outside `people/` so
// only the proxy writes it; `can()` lets the owner read it.
//   usage/+A/<day>/<time>-<actor>-<nonce>.html
// Rows carry sizes, tokens, and cost; never prompt or reply text.
import { randomBytes } from "node:crypto"

const LIMIT = 10 * 1024 * 1024
const FIELDS = ["model", "actor", "status", "request_bytes", "reply_bytes", "prompt_tokens", "completion_tokens", "cost"]

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
export function usage_row({ model, actor, status, request_bytes, reply_bytes, usage }) {
  const values = {
    model: usage?.model ?? model,
    actor,
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

/** Reads rows back; unknown text is ignored. */
export function read_rows(html) {
  const rows = []
  for (const [row] of html.matchAll(/<p itemscope itemtype="\/usage">.*?<\/p>/g)) {
    const values = {}
    for (const [, name, value] of row.matchAll(/itemprop="(\w+)" content="([^"]*)"/g)) values[name] = value
    for (const name of FIELDS.slice(2)) values[name] = Number(values[name])
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

/**
 * Storage-backed ledger for the proxy. `spent()` reads today's folder once,
 * then counts in memory; each proxy instance keeps its own count.
 */
export function usage_ledger(storage) {
  const totals = new Map() // `${phone} ${day}` -> Promise<{ tokens, cost }>
  const total = (phone, day) => {
    const key = `${phone} ${day}`
    if (!totals.has(key)) {
      for (const old of totals.keys()) if (!old.endsWith(day)) totals.delete(old)
      const read = ledger.day(phone, day).then(({ rows }) => ({
        tokens: rows.reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0),
        cost: rows.reduce((sum, row) => sum + row.cost, 0),
      }))
      read.catch(() => totals.delete(key))
      totals.set(key, read)
    }
    return totals.get(key)
  }
  const ledger = {
    spent: (phone, now) => total(phone, today(now)),
    async record(phone, row, now = new Date()) {
      const version = await storage.put(usage_key(phone, row.actor, now), usage_row(row), { if_version: null })
      const key = `${phone} ${today(now)}`
      if (totals.has(key)) {
        const sum = await totals.get(key).catch(() => null)
        if (sum) {
          sum.tokens += (row.usage?.prompt_tokens ?? 0) + (row.usage?.completion_tokens ?? 0)
          sum.cost += row.usage?.cost ?? 0
        }
      }
      return version
    },
    async day(phone, day) {
      const folder = usage_day(phone, day)
      const { files } = await storage.list(folder)
      const pages = await Promise.all(files.map((name) => storage.get(folder + name)))
      const rows = pages.flatMap((page) => (page ? read_rows(page.body.toString("utf8")) : []))
      return { rows, cost: rows.reduce((sum, row) => sum + row.cost, 0) }
    },
  }
  return ledger
}

/** Free daily allowance; either limit may be Infinity. */
export const over_quota = (spent, { tokens = Infinity, cost = Infinity } = {}) =>
  spent.tokens >= tokens || spent.cost >= cost
