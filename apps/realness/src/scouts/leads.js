import { read_items } from '#root/lib/items.js'

/**
 * One lead as the run reports it, and as the report reads it back.
 * @typedef {object} Lead
 * @property {string} url
 * @property {string} title
 * @property {string} org
 * @property {string} source
 * @property {number} score
 * @property {string} reason
 * @property {string} node
 * @property {string} research
 * @property {string} draft
 */

/**
 * A record as it came in, before it is checked.
 * @typedef {Record<string, unknown>} RawLead
 */

/** A lead worth researching, in the profile's score band. */
export const RESEARCH_MIN = 6
/** A lead worth a drafted note. */
export const DRAFT_MIN = 7
/** The top of the score band. */
const SCORE_MAX = 10

/** Query names that only track a click. */
const TRACKING = /^(utm_\w+|ref|source|fbclid|gclid|mc_\w+)$/

/** A URL as the store compares it: no scheme, no www, no tracking query or
 * fragment, no trailing slash, and the host in lower case. The same posting
 * reached through a tracking link is one lead; `item?id=1` and `item?id=2` are
 * two. */
export const key_of = url => {
  const parsed = new URL(url)
  const host = parsed.host.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname.replace(/\/$/, '')
  const query = [...parsed.searchParams]
    .filter(([name]) => !TRACKING.test(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('&')
  return query ? `${host}${path}?${query}` : `${host}${path}`
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
const is_text = value => typeof value === 'string' && value.trim() !== ''

/** @param {unknown} value */
const is_score = value =>
  is_text(value) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0 &&
  Number(value) <= SCORE_MAX

/**
 * Why a lead record cannot be used, or null.
 * @param {RawLead} value
 */
const lead_problem = value => {
  if (!is_text(value.url)) return 'no url'
  if (!URL.canParse(value.url)) return 'url is not absolute'
  if (!is_score(value.score)) return 'score is not 0-10'
  if (!is_text(value.reason)) return 'no reason'
  return null
}

/**
 * The fields a report reads back; anything else the run wrote is dropped.
 * @param {RawLead} lead
 * @returns {Lead}
 */
const kept = lead => ({
  url: String(lead.url),
  title: String(lead.title ?? ''),
  org: String(lead.org ?? ''),
  source: String(lead.source ?? ''),
  score: Number(lead.score),
  reason: String(lead.reason).trim(),
  node: String(lead.node ?? ''),
  research: String(lead.research ?? ''),
  draft: String(lead.draft ?? '')
})

/**
 * Read the run's `/find` items. An item that fails is reported, not thrown,
 * so one bad record does not lose the run.
 * @param {string} html
 */
const WHY_MIN_CHARS = 20

/** A page with no leads says in a sentence why it has none. */
const said_why = html =>
  (/<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length >= WHY_MIN_CHARS

export const read_leads = html => {
  /** @type {Lead[]} */
  const leads = []
  /** @type {{ item: number, problem: string }[]} */
  const problems = []
  const items = read_items(html, 'find')
  items.forEach((value, index) => {
    const problem = lead_problem(value)
    if (problem) problems.push({ item: index + 1, problem })
    else leads.push(kept(value))
  })
  if (html.trim() && !items.length && !said_why(html))
    problems.push({ item: 0, problem: 'the run wrote an empty page' })
  return { leads: highest_per_url(leads), problems }
}

/**
 * The same opening on two boards is one lead. The better score wins.
 * @param {Lead[]} leads
 */
export const highest_per_url = leads => {
  const by_url = new Map()
  for (const lead of leads) {
    const key = key_of(lead.url)
    const seen = by_url.get(key)
    if (!seen || lead.score > seen.score) by_url.set(key, lead)
  }
  return [...by_url.values()].sort((left, right) => right.score - left.score)
}

/**
 * Leads at or above a score band, best first.
 * @param {Lead[]} leads
 * @param {number} score
 */
export const at_least = (leads, score) =>
  leads.filter(lead => lead.score >= score)
