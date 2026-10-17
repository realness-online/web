import { billing_key, PLAN, read_plan } from '#root/src/proxy/billing.js'
import {
  aggregate_trend,
  cache_bounds,
  default_cache_path,
  default_host,
  default_project_id,
  read_jsonl_cache
} from '#root/tools/ops/hosting-traffic.js'

const DAYS = 30
const WEEK = 7
const WEEKS = 2
const CENTS = 100
const DATE_END = 10

/**
 * The same readings `npm run traffic` prints, from the same aggregation:
 * people on the homepage, how many went deeper, and arrivals from other
 * sites, for this week and last, plus a daily homepage series. Periods the
 * archive does not reach are null, never zero.
 * @param {ReturnType<typeof read_jsonl_cache>} rows
 * @param {object} [options]
 * @param {string} [options.host]
 * @param {number} [options.now]
 */
export const traffic_summary = (
  rows,
  { host = default_host, now = Date.now() } = {}
) => {
  const { oldest, newest } = cache_bounds(rows)
  const shared = { host, include_bots: false, all_paths: false, now, oldest }
  const [previous, week] = aggregate_trend(rows, {
    ...shared,
    days: WEEK,
    buckets: WEEKS
  })
  const daily = aggregate_trend(rows, { ...shared, days: 1, buckets: DAYS })
    .filter(day => day.covered)
    .map(day => ({ date: day.end.slice(0, DATE_END), people: day.landed }))
  return {
    people: week.landed,
    deeper: week.deeper,
    outside: week.outside,
    previous: previous.covered ? previous.landed : null,
    daily,
    newest
  }
}

/**
 * Paying people from their plan records: a plan is a Stripe subscription when
 * it carries a subscription id, since granted credit has none. No Stripe call.
 * @param {{ ls: (path: string) => Promise<string[]>, cat: (path: string) => Promise<Buffer> }} store
 * @param {number} [now]
 */
export const read_plans = async (store, now = Date.now()) => {
  const at = new Date(now)
  const listed = await store.ls('can://billing/').catch(() => [])
  const rows = await Promise.all(
    listed
      .filter(name => name.endsWith('/'))
      .map(async name => {
        const phone = name.replace(/\/$/, '')
        const html = await store
          .cat(`can://${billing_key(phone)}`)
          .catch(() => null)
        return html ? read_plan(html.toString('utf8')) : null
      })
  )
  const live = /** @type {NonNullable<ReturnType<typeof read_plan>>[]} */ (
    rows.filter(Boolean)
  ).filter(
    plan =>
      ['active', 'canceled'].includes(plan.status) &&
      (plan.credit ?? 0) > 0 &&
      !(plan.start && at < new Date(`${plan.start}T00:00:00Z`)) &&
      !(plan.end && at >= new Date(plan.end))
  )
  const paying = live.filter(plan => plan.subscription)
  return {
    paying: paying.length,
    granted: live.length - paying.length,
    revenue: (paying.length * PLAN.amount) / CENTS
  }
}

/**
 * Read the local traffic archive; never calls gcloud.
 * @param {object} [options]
 * @param {string} [options.path]
 * @param {number} [options.now]
 */
export const read_traffic = ({ path, now = Date.now() } = {}) => {
  const file =
    path ?? default_cache_path(default_project_id(), default_host, false)
  const rows = read_jsonl_cache(file)
  if (!rows.length) throw new Error('no traffic archive; run npm run traffic')
  return traffic_summary(rows, { now })
}
