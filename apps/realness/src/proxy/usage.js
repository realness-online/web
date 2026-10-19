import { randomBytes as random_bytes } from 'node:crypto'
import {
  ISO_DATE,
  ISO_TIME_START,
  MIB,
  MS_PER_DAY,
  MS_PER_SECOND
} from '#root/lib/units.js'
import {
  INDEX,
  NUMBERS,
  day_files,
  free_tokens,
  read_rows as parse_rows,
  sum_rows
} from './rows.js'
/* eslint-disable no-await-in-loop -- compaction retries wait between tries */

export { day_files, sum_rows }

const LIMIT_MIB = 10
const DATA_PREFIX = 'data: '.length
const TRIES = 12
const JITTER_FLOOR = 0.5
const MAX_BACKOFF = 4

const LIMIT = LIMIT_MIB * MIB
const FIELDS = ['model', 'actor', 'payer', 'via', 'plan', ...NUMBERS, 'call']

/** How a call came, from the caller's id. */
const via_of = actor => {
  if (actor?.startsWith('app-')) return 'app'
  if (actor?.startsWith('a-')) return 'actor'
  return 'phone'
}

/** Watches a reply as it streams past; finish() returns its usage. */
export const usage_meter = () => {
  let pending = ''
  let bytes = 0
  let whole = ''
  let found = null
  const read = text => {
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
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines)
        if (line.startsWith('data: ') && line.includes('"usage"'))
          read(line.slice(DATA_PREFIX))
    },
    finish() {
      if (pending.startsWith('data: ')) read(pending.slice(DATA_PREFIX))
      if (!found) read(whole)
      whole = pending = ''
      return { reply_bytes: bytes, usage: found }
    }
  }
}

const escape = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

/** One call as an HTML Lines row. */
export const usage_row = ({
  model,
  actor,
  payer,
  plan,
  status,
  request_bytes,
  reply_bytes,
  usage,
  call = ''
}) => {
  const values = {
    model: usage?.model ?? model,
    actor,
    payer: payer ?? '',
    via: via_of(actor),
    plan: plan === 'paid' ? 'paid' : 'free',
    status,
    request_bytes,
    reply_bytes,
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    cost: usage?.cost ?? 0,
    call
  }
  const props = FIELDS.filter(name => name !== 'call' || call)
    .map(name => `<meta itemprop="${name}" content="${escape(values[name])}">`)
    .join('')
  return `<p itemscope itemtype="/usage">${props}</p>\n`
}

/**
 * Reads rows back with the defaults the proxy fills in. `payer` fills older
 * rows. A row seen twice (composed, its piece not yet deleted) counts once.
 */
export const read_rows = (html, payer = '') =>
  parse_rows(html, payer).map(row => ({
    ...row,
    via: row.via || via_of(row.actor),
    plan: row.plan || 'free'
  }))

const usage_day = (phone, day) => `usage/${phone}/${day}/`

/** Google takes about one write a second per file; compose up to 32. */
const BATCH = 31
const pause = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })

/**
 * Fold the day's waiting pieces, ours among them, onto index.html and
 * delete them. One compose carries every piece waiting, so a burst of calls
 * costs a few writes. A conflict or a busy file waits and tries again; when
 * our piece is gone, another call folded it.
 */
const append_piece = async (
  storage,
  folder,
  piece,
  { tries = TRIES, wait = MS_PER_SECOND } = {}
) => {
  const index = folder + INDEX
  for (let attempt = 0; attempt < tries; attempt++) {
    const waiting = day_files((await storage.list(folder)).files).slice(0, -1)
    if (!waiting.includes(piece)) return true
    const batch = [piece, ...waiting.filter(name => name !== piece)]
      .slice(0, BATCH)
      .sort()
    const version = await storage.stat(index)
    try {
      const sources = batch.map(name => folder + name)
      await storage.compose(
        index,
        version === null ? sources : [index, ...sources],
        { if_version: version }
      )
      await Promise.all(sources.map(key => storage.delete(key).catch(() => {})))
      return true
    } catch (error) {
      if (error.code !== 'conflict' && error.code !== 'busy') throw error
      await pause(
        wait *
          (JITTER_FLOOR + Math.random()) *
          Math.min(attempt + 1, MAX_BACKOFF)
      )
    }
  }
  return false
}

export const usage_key = (phone, actor, now = new Date()) => {
  const iso = now.toISOString()
  return `${usage_day(phone, iso.slice(0, ISO_DATE))}${iso.slice(ISO_TIME_START).replace(/[:.]/g, '')}-${actor}-${random_bytes(3).toString('hex')}.html`
}

const today = (now = new Date()) => now.toISOString().slice(0, ISO_DATE)

/** Every UTC day from `start` (YYYY-MM-DD) through `now`'s day. */
export const days_since = (start, now = new Date()) => {
  const days = []
  const end = today(now)
  for (
    const at = new Date(`${start}T00:00:00Z`);
    at.toISOString().slice(0, ISO_DATE) <= end;
    at.setUTCDate(at.getUTCDate() + 1)
  )
    days.push(at.toISOString().slice(0, ISO_DATE))
  return days
}

/** Every UTC day of `now`'s month, up to and including today. */
export const month_days = (now = new Date()) =>
  days_since(`${today(now).slice(0, 8)}01`, now)

const add = (a, b) => ({ tokens: a.tokens + b.tokens, cost: a.cost + b.cost })
const KEEP_DAYS = 62

/**
 * Storage-backed ledger for the proxy. Each day folder is read once, then
 * counted in memory; each proxy instance keeps its own count.
 */
export const usage_ledger = (storage, append = {}) => {
  const totals = new Map()
  const total = (phone, day) => {
    const key = `${phone} ${day}`
    if (!totals.has(key)) {
      const read = ledger.day(phone, day).then(({ rows }) => sum_rows(rows))
      read.catch(() => totals.delete(key))
      totals.set(key, read)
    }
    return totals.get(key)
  }
  const forget = now => {
    const oldest = new Date(now.getTime() - KEEP_DAYS * MS_PER_DAY)
      .toISOString()
      .slice(0, ISO_DATE)
    for (const key of totals.keys())
      if (key.slice(-ISO_DATE) < oldest) totals.delete(key)
  }
  const ledger = {
    /** `{ day, month }`, each `{ tokens, cost }`, in UTC. */
    async spent(phone, now = new Date()) {
      forget(now)
      const sums = await Promise.all(
        month_days(now).map(day => total(phone, day))
      )
      return {
        day: { ...sums.at(-1) },
        month: sums.reduce(add, { tokens: 0, cost: 0 })
      }
    },
    /** `{ tokens, cost }` from `start` (YYYY-MM-DD) through today. */
    async spent_since(phone, start, now = new Date()) {
      forget(now)
      const sums = await Promise.all(
        days_since(start, now).map(day => total(phone, day))
      )
      return sums.reduce(add, { tokens: 0, cost: 0 })
    },
    async record(phone, row, now = new Date()) {
      const key = usage_key(phone, row.actor, now)
      const folder = key.slice(0, key.lastIndexOf('/') + 1)
      const piece = key.slice(folder.length)
      const total_key = `${phone} ${today(now)}`
      totals.get(total_key)?.then(
        sum => {
          sum.tokens += free_tokens({
            plan: row.plan,
            model: row.usage?.model ?? row.model,
            prompt_tokens: row.usage?.prompt_tokens ?? 0,
            completion_tokens: row.usage?.completion_tokens ?? 0
          })
          sum.cost += row.usage?.cost ?? 0
        },
        () => {}
      )
      const version = await storage.put(
        key,
        usage_row({ ...row, call: piece }),
        { if_version: null, gzip: true }
      )
      await append_piece(storage, folder, piece, append).catch(() => false)
      return version
    },
    async day(phone, day) {
      const folder = usage_day(phone, day)
      const { files } = await storage.list(folder)
      const pieces = await Promise.all(
        day_files(files)
          .slice(0, -1)
          .map(name => storage.get(folder + name))
      )
      const index = files.length ? await storage.get(folder + INDEX) : null
      const rows = read_rows(
        [index, ...pieces]
          .map(page => page?.body.toString('utf8') ?? '')
          .join(''),
        phone
      )
      return { rows, cost: rows.reduce((sum, row) => sum + row.cost, 0) }
    }
  }
  return ledger
}

/** Free use runs a free model, so its limits count tokens. */
export const FREE_LIMITS = {
  day: { tokens: 250_000 },
  month: { tokens: 3_000_000 }
}

/** Free limits after env overrides; "Infinity" lifts one. */
export const free_limits = (env = {}) => {
  const pick = (name, fallback = Infinity) =>
    env[name] ? Number(env[name]) : fallback
  return {
    day: {
      tokens: pick('FREE_TOKENS_PER_DAY', FREE_LIMITS.day.tokens),
      cost: pick('FREE_COST_PER_DAY')
    },
    month: {
      tokens: pick('FREE_TOKENS_PER_MONTH', FREE_LIMITS.month.tokens),
      cost: pick('FREE_COST_PER_MONTH')
    }
  }
}

/**
 * Which limit is spent: "day", "month", or null. Limits are `{ day, month }`,
 * each `{ tokens, cost }`; a missing limit is no limit. Paid plans (b1d) pass
 * their own limits through the same check.
 */
export const over_limit = (spent, limits = {}) => {
  const over = (used, { tokens = Infinity, cost = Infinity } = {}) =>
    used.tokens >= tokens || used.cost >= cost
  if (over(spent.month, limits.month)) return 'month'
  if (over(spent.day, limits.day)) return 'day'
  return null
}
