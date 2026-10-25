import { createHash as create_hash } from 'node:crypto'
import {
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join } from 'node:path'

export const METHODS = ['static', 'browser', 'firecrawl']
const HOUR = 3_600_000
const MIN_HOURS = 0.25
const MAX_HOURS = 2160
const SKIP_AFTER = 3
const RETRY_HOURS = 7 * 24
const KEEP_ATTEMPTS = 20

export const hash = text => create_hash('sha256').update(text).digest('hex')

const read_json = (file, fallback) => {
  try {
    return JSON.parse(read_file_sync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const write_json = (file, value) => {
  mkdir_sync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  write_file_sync(tmp, `${JSON.stringify(value, null, 1)}\n`)
  rename_sync(tmp, file)
}

/**
 * How long a kept page stays current. First answer wins: the caller, the
 * page's own headers, a never-keep rule, what re-checks taught this page,
 * then the rule for its kind of URL, then the default.
 */
export const cache_time = ({ url, caller_hours = null, headers = {}, learned_hours = null, times }) => {
  if (caller_hours != null) return { hours: caller_hours, why: 'caller' }
  const cc = headers.cache_control ?? ''
  if (/no-store/i.test(cc)) return { hours: 0, why: 'no-store' }
  const max_age = cc.match(/(?:^|,)\s*(?:s-)?max-age=(\d+)/i)
  if (max_age && Number(max_age[1]) > 0) return { hours: Number(max_age[1]) / 3600, why: 'max-age' }
  const expires = Date.parse(headers.expires ?? '') - Date.now()
  if (expires > 0) return { hours: expires / HOUR, why: 'expires' }
  const rule = times.rules.find(r => new RegExp(r.pattern, 'i').test(url))
  if (rule?.hours === 0) return { hours: 0, why: rule.kind }
  if (learned_hours) return { hours: learned_hours, why: 'learned' }
  return rule ? { hours: rule.hours, why: rule.kind } : { hours: times.default_hours, why: 'default' }
}

/** A re-check that finds the page unchanged doubles its time; a change halves it. */
export const learn = (hours, changed) => Math.min(MAX_HOURS, Math.max(MIN_HOURS, changed ? hours / 2 : hours * 2))

/** Methods worth trying on a site, in order: skip one that keeps failing there, for a while. */
export const route = (site, now = Date.now()) =>
  METHODS.filter(method => {
    const record = site.methods?.[method]
    if (!record || record.fails_in_row < SKIP_AFTER) return true
    return now - Date.parse(record.last_at) >= RETRY_HOURS * HOUR
  })

/** Is the kept page current? The page's validators decide first, then its age. */
export const is_current = ({ entry, validators = {}, time, now = Date.now() }) => {
  if (!entry.page || time.hours <= 0) return false
  for (const key of ['etag', 'last_modified']) {
    if (entry.validators?.[key] && validators[key]) return entry.validators[key] === validators[key]
  }
  return now - Date.parse(entry.page.fetched) < time.hours * HOUR
}

/**
 * Should a kept page be dropped? A page with an ETag or Last-Modified stays until it
 * changes (a re-read replaces it). One without is dropped after idle_days unread.
 */
export const is_idle = (entry, { idle_days = 30, now = Date.now() } = {}) => {
  if (!entry.page) return false
  if (entry.validators?.etag || entry.validators?.last_modified) return false
  const last = Date.parse(entry.read_at ?? entry.page.fetched)
  return now - last >= idle_days * 24 * HOUR
}

/** Drop idle pages' text, keeping their attempts and checks. Returns how many. */
export const prune = (root, options = {}) => {
  const dir = join(root, 'pages')
  let dropped = 0
  let files = []
  try {
    files = readdir_sync(dir).filter(f => f.endsWith('.json'))
  } catch {
    return 0
  }
  for (const f of files) {
    const entry = read_json(join(dir, f), null)
    if (!entry || !is_idle(entry, options)) continue
    delete entry.page
    delete entry.read_at
    write_json(join(dir, f), entry)
    dropped += 1
  }
  return dropped
}

export const open_cache = ({ root, url, times_file }) => {
  const page_file = join(root, 'pages', `${hash(url)}.json`)
  const site_file = join(root, 'sites', `${new URL(url).host}.json`)
  const entry = read_json(page_file, { url, attempts: [] })
  const site = read_json(site_file, { host: new URL(url).host, methods: {} })
  const times = read_json(times_file, { default_hours: 24, rules: [] })

  const time = ({ caller_hours = null, headers = {} } = {}) =>
    cache_time({ url, caller_hours, headers, learned_hours: entry.learned_hours, times })

  return {
    entry,
    site,
    time,
    route: () => route(site),
    current: ({ validators, caller_hours, headers }) =>
      is_current({ entry, validators, time: time({ caller_hours, headers }) }),

    /** Headers that let the site answer 304 Not Modified for the kept page. */
    conditional: () => ({
      ...(entry.validators?.etag && { 'if-none-match': entry.validators.etag }),
      ...(entry.validators?.last_modified && { 'if-modified-since': entry.validators.last_modified })
    }),

    /** Record one attempt. outcome is 'ok' or why it failed. */
    attempt(method, outcome, { ms = null, chars = null } = {}) {
      const at = new Date().toISOString()
      entry.attempts = [...entry.attempts, { at, method, outcome, ms, chars }].slice(-KEEP_ATTEMPTS)
      const record = site.methods[method] ?? { oks: 0, fails: 0, fails_in_row: 0 }
      if (outcome === 'ok') Object.assign(record, { oks: record.oks + 1, fails_in_row: 0 })
      else Object.assign(record, { fails: record.fails + 1, fails_in_row: record.fails_in_row + 1 })
      site.methods[method] = { ...record, last_at: at, last_outcome: outcome }
    },

    /** Keep a page read now. Re-reading by the same method teaches the cache time. */
    store({ method, title, markdown }, { validators = {}, headers = {}, caller_hours = null } = {}) {
      const kept = time({ caller_hours, headers })
      if (kept.hours <= 0) return
      const digest = hash(markdown)
      const previous = entry.page
      const expired = previous && !is_current({ entry, time: time({ headers }) })
      if (expired && previous.method === method && previous.hash) {
        const changed = previous.hash !== digest
        const base = entry.learned_hours ?? time({ headers }).hours
        if (base > 0) entry.learned_hours = learn(base, changed)
        entry.checks = [...(entry.checks ?? []), { at: new Date().toISOString(), changed }].slice(-KEEP_ATTEMPTS)
      }
      if (previous && previous.hash !== digest) entry.reuses = 0
      entry.page = { method, title, markdown, hash: digest, fetched: new Date().toISOString() }
      entry.validators = validators
    },

    /** Mark the kept page as read now; idle pages are pruned by this. from_cache counts a reuse. */
    touch({ from_cache = false } = {}) {
      if (!entry.page) return
      entry.read_at = new Date().toISOString()
      if (from_cache) entry.reuses = (entry.reuses ?? 0) + 1
    },

    save() {
      write_json(page_file, entry)
      write_json(site_file, site)
    }
  }
}
