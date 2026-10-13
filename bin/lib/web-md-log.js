
import { appendFileSync as append_file_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'
import { hash } from './web-md-cache.js'

/** What a run ended as, from web-md's source line or its failure. */
export const outcome_of = source => {
  if (source === 'blocked' || source === 'failed') return source
  if (/^cached .*not modified$/.test(source)) return 'not-modified'
  if (source.startsWith('cached ')) return 'cache'
  return source
}

/** One run's line. attempts are this run's only, without page sizes beyond chars. */
export const read_line = ({ url, source, attempts, seen_before, chars = null, forced = null, kept = null, at = new Date() }) => ({
  at: at.toISOString(),
  url: hash(url),
  site: hash(new URL(url).host),
  outcome: outcome_of(source),
  seen_before,
  ...(forced && { forced }),
  chars,
  ...(kept && { kept }),
  attempts: attempts.map(({ method, outcome, ms, chars }) => ({ method, outcome, ms, chars }))
})

/**
 * What a read learned about the copy it found kept, for judging cache times later.
 * prior: the kept page before this run. now: what this run served. null if none was kept.
 *   age_h      how old the kept copy was
 *   ttl_h/why  how long it counted as current, and which rule said so
 *   changed    re-read by the same method: did the text differ? null when not re-read
 *   validators the kept copy had an ETag or Last-Modified
 *   matched    re-read: did the site's validators still match? (matched + changed = a lying validator)
 */
export const kept_line = ({ prior, read, hash: digest = null, method = null, validators = {}, ttl, now = Date.now() }) => {
  if (!prior) return null
  const had = Boolean(prior.validators?.etag || prior.validators?.last_modified)
  const same = read && method === prior.method && prior.hash && digest
  const key = ['etag', 'last_modified'].find(k => prior.validators?.[k] && validators[k])
  return {
    age_h: Number(((now - Date.parse(prior.fetched)) / 3_600_000).toFixed(6)),
    ttl_h: ttl.hours,
    why: ttl.why,
    validators: had,
    changed: same ? prior.hash !== digest : null,
    matched: read && key ? prior.validators[key] === validators[key] : null
  }
}

const median = xs => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Reads over a period, judged against the cache times (r4). Grouped by the rule
 * that set the time (max-age, a URL kind, learned, default) or by site.
 *   rereads    copies read again: how often the text had changed, at what age.
 *              Mostly unchanged: the time is too short. Often changed: too long.
 *   served     reads answered from the cache, by the kept copy's age: does anyone
 *              read past 7, 30, 90 days? That sizes the idle window.
 *   lied       validators matched but the text changed: the ETag can't be trusted.
 *   hit        share of reads answered without rendering.
 */
export const assess = (lines, group_of = line => line.kept?.why ?? 'not kept') => {
  const groups = {}
  for (const line of lines) {
    const g = (groups[group_of(line)] ??= {
      reads: 0,
      hits: 0,
      rereads: 0,
      changed: 0,
      changed_ages: [],
      unchanged_ages: [],
      served: { under_7d: 0, '7_30d': 0, '30_90d': 0, over_90d: 0 },
      validated: 0,
      lied: 0
    })
    g.reads += 1
    if (line.outcome === 'cache' || line.outcome === 'not-modified') g.hits += 1
    const k = line.kept
    if (!k) continue
    if (line.outcome === 'cache' || line.outcome === 'not-modified') {
      const d = k.age_h / 24
      g.served[d < 7 ? 'under_7d' : d < 30 ? '7_30d' : d < 90 ? '30_90d' : 'over_90d'] += 1
    }
    if (k.changed !== null) {
      g.rereads += 1
      if (k.changed) {
        g.changed += 1
        g.changed_ages.push(k.age_h)
      } else g.unchanged_ages.push(k.age_h)
    }
    if (k.matched !== null && k.changed !== null) {
      g.validated += 1
      if (k.matched && k.changed) g.lied += 1
    }
  }
  for (const g of Object.values(groups)) {
    g.median_changed_h = median(g.changed_ages)
    g.median_unchanged_h = median(g.unchanged_ages)
    delete g.changed_ages
    delete g.unchanged_ages
  }
  return groups
}

/**
 * How often kept copies are reused: per page, reads served from the cache
 * against reads that had to fetch or render. Bands show whether keeping pays:
 * many copies never reused means the cache stores more than it saves.
 */
export const reuse = lines => {
  const pages = new Map()
  for (const line of lines) {
    const p = pages.get(line.url) ?? { url: line.url, site: line.site, reads: 0, reused: 0 }
    p.reads += 1
    if (line.outcome === 'cache' || line.outcome === 'not-modified') p.reused += 1
    pages.set(line.url, p)
  }
  const bands = { never: 0, '1': 0, '2_5': 0, over_5: 0 }
  for (const p of pages.values()) bands[p.reused === 0 ? 'never' : p.reused === 1 ? '1' : p.reused <= 5 ? '2_5' : 'over_5'] += 1
  const top = [...pages.values()].filter(p => p.reused > 0).sort((a, b) => b.reused - a.reused).slice(0, 10)
  return { pages: pages.size, bands, top }
}

export const log_read = (root, line) => {
  mkdir_sync(root, { recursive: true })
  append_file_sync(join(root, `${line.at.slice(0, 10)}.jsonl`), `${JSON.stringify(line)}\n`)
}

export const read_day = (root, day) => {
  let text = ''
  try {
    text = read_file_sync(join(root, `${day}.jsonl`), 'utf8')
  } catch {
    return []
  }
  return text
    .split('\n')
    .filter(Boolean)
    .flatMap(row => {
      try {
        return [JSON.parse(row)]
      } catch {
        return []
      }
    })
}

/**
 * A day's reads, counted. A repeat is a URL read earlier the same day, in these
 * lines, or before (seen_before). Rendered counts runs that tried a renderer.
 */
export const summarize = lines => {
  const by_outcome = {}
  const by_method = {}
  const urls = new Map()
  let repeats_today = 0
  let seen_before = 0
  let rendered = 0
  for (const line of lines) {
    by_outcome[line.outcome] = (by_outcome[line.outcome] ?? 0) + 1
    if (urls.has(line.url)) repeats_today += 1
    urls.set(line.url, (urls.get(line.url) ?? 0) + 1)
    if (line.seen_before) seen_before += 1
    if (line.attempts.some(a => a.method !== 'static')) rendered += 1
    for (const a of line.attempts) {
      const m = (by_method[a.method] ??= { ok: 0, failed: 0, ms: 0 })
      if (a.outcome === 'ok') m.ok += 1
      else m.failed += 1
      m.ms += a.ms ?? 0
    }
  }
  return {
    reads: lines.length,
    urls: urls.size,
    repeats_today,
    seen_before,
    rendered,
    by_outcome,
    by_method
  }
}
