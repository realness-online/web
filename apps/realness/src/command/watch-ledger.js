import { isUtf8 as is_utf8 } from "node:buffer"

const INDEX = "index.html"
const NUMBERS = ["status", "request_bytes", "reply_bytes", "prompt_tokens", "completion_tokens", "cost"]

/** Every UTC day of `now`'s month, up to and including today. */
export const month_days = (now = new Date()) => {
  const end = now.toISOString().slice(0, 10)
  const days = []
  for (let at = new Date(`${end.slice(0, 8)}01T00:00:00Z`); at.toISOString().slice(0, 10) <= end; at.setUTCDate(at.getUTCDate() + 1)) days.push(at.toISOString().slice(0, 10))
  return days
}

/** A day folder's pieces first, then index.html; index is written last. */
export const day_files = (files) => [...files.filter((name) => name.endsWith(".html") && name !== INDEX).sort(), INDEX]

/** The ledger path for one person and day, under `usage/`. */
export const usage_day = (phone, day) => `usage/${phone}/${day}/`

/** Rows as the proxy writes them; unknown text is ignored, one row per call. */
export const read_rows = (html, payer = "") => {
  const rows = []
  const seen = new Set()
  for (const [row] of html.matchAll(/<p itemscope itemtype="\/usage">.*?<\/p>/g)) {
    const values = {}
    for (const [, name, value] of row.matchAll(/itemprop="(\w+)" content="([^"]*)"/g)) values[name] = value
    if (values.call) {
      if (seen.has(values.call)) continue
      seen.add(values.call)
    }
    for (const name of NUMBERS) values[name] = Number(values[name])
    values.payer ||= payer
    rows.push(values)
  }
  return rows
}

const free_tokens = (row) => (row.plan === "paid" || (typeof row.model === "string" && row.model.endsWith(":free")) ? 0 : (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0))

/** Free-plan tokens and all cost; paid rows and free models spend no tokens. */
export const sum_rows = (rows) => ({
  tokens: rows.reduce((sum, row) => sum + free_tokens(row), 0),
  cost: rows.reduce((sum, row) => sum + (row.cost ?? 0), 0),
})

const add = (a, b) => ({ tokens: a.tokens + b.tokens, cost: a.cost + b.cost })

/** The ledger under `usage/+A/<day>/`, read through the service. */
export const ledger = (store) => ({
  async spent(phone, now = new Date()) {
    const sums = []
    let found = false
    for (const day of month_days(now)) {
      const folder = usage_day(phone, day)
      const listed = await store.ls(`can://${folder}`).catch((error) => {
        if (error.status === 404 || /: 404$/.test(error.message)) return null
        throw error
      })
      if (listed) found = true
      const names = (listed ?? []).filter((name) => !name.endsWith("/"))
      const ordered = day_files(names).filter((name) => names.includes(name))
      let html = ""
      for (const name of ordered) {
        const page = await store.cat(`can://${folder}${name}`)
        if (!is_utf8(page)) throw new Error("model ledger is not UTF-8")
        html += page.toString("utf8")
      }
      sums.push({ date: day, ...sum_rows(read_rows(html, phone)) })
    }
    if (!found) throw new Error("no model ledger for this month")
    const today = sums.at(-1)
    return { day: { tokens: today.tokens, cost: today.cost }, month: sums.reduce(add, { tokens: 0, cost: 0 }), daily: sums }
  },
})