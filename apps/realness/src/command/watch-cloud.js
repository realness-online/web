import {
  compute_inventory,
  month_cost,
  services
} from '#root/src/control/cloud-reads.js'
import { ENVIRONMENTS } from '#root/tools/control/webspace.config.js'
import { attempt } from '#root/src/control/exec.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import {
  default_cache_path,
  default_host,
  default_project_id
} from '#root/tools/ops/hosting-traffic.js'

const SPEND_EVERY_MINUTES = 15
const HEALTH_EVERY_MINUTES = 5
const TRAFFIC_EVERY_MINUTES = 5
const SITE_DAYS = 7
const SITE_WEEKS = 2

/** Cache slow reads, including failures, so refresh keys do not run paid queries. */
/**
 * Wrap a reader so it runs at most once per interval; every caller shares the
 * pending promise.
 * @template T
 * @param {() => Promise<T>} read
 * @param {number} interval_ms
 * @param {() => number} [now]
 * @returns {() => Promise<T>}
 */
export const cached_read = (read, interval_ms, now = Date.now) => {
  let next = 0
  /** @type {Promise<T> | null} */
  let pending = null
  return () => {
    const time = now()
    if (!pending || time >= next) {
      next = time + interval_ms
      pending = Promise.resolve().then(read)
    }
    return pending
  }
}

/**
 * Bring the local traffic archive up to date with Cloud Logging. A gcloud run
 * pulls the forward gap; a failure returns a short reason and leaves the
 * archive as it was.
 * @param {{ sync?: (options: object) => { added: number, pages: number }, project: string, host: string, now?: () => number }} options
 */
export const sync_traffic = ({ sync, project, host, now = Date.now }) => {
  if (!sync)
    return {
      state: 'failed',
      error: 'no traffic reader; run npm run traffic',
      at: new Date(now()).toISOString()
    }
  try {
    const result = sync({
      cache_path: default_cache_path(project, host, false),
      project,
      host,
      days: SITE_DAYS * SITE_WEEKS,
      all_paths: false,
      cache_only: false,
      refresh: false
    })
    return {
      state: 'ok',
      added: result.added,
      pages: result.pages,
      at: new Date(now()).toISOString()
    }
  } catch (error) {
    return {
      state: 'failed',
      error: error.message,
      at: new Date(now()).toISOString()
    }
  }
}

/**
 * Billing covers configured exports; inventory includes their billed projects.
 * Plans read from `store`; without one they are unknown. Traffic reads the
 * local archive; without a `sync` reader it is never refreshed.
 * @param {{ environments?: object, run?: typeof attempt, now?: () => number, store?: Parameters<typeof import('./watch-traffic.js').read_plans>[0] | null, sync?: (options: object) => { added: number, pages: number }, traffic_project?: string }} [options]
 */
export const cloud_sources = ({
  environments = ENVIRONMENTS,
  run = attempt,
  now = Date.now,
  store = null,
  sync,
  traffic_project = default_project_id()
} = {}) => {
  const clouds = [
    ...new Map(
      Object.values(environments)
        .filter(config => config.cloud)
        .map(({ cloud }) => [cloud.project, cloud])
    ).values()
  ]
  const tables = [
    ...new Set(
      Object.values(environments)
        .map(config => config.cloud?.billing)
        .filter(Boolean)
    )
  ]
  const projects = new Set(clouds.map(cloud => cloud.project))
  const bounded_run = (command, args) => run(command, args, { timeout: 60_000 })
  const billing = cached_read(
    async () => {
      if (!tables.length) throw new Error('no billing export configured')
      const exports = await Promise.all(
        tables.map(billing =>
          month_cost({ billing }, { run: bounded_run, now: new Date(now()) })
        )
      )
      for (const bill of exports)
        for (const row of bill.rows) if (row.project) projects.add(row.project)
      return { exports }
    },
    SPEND_EVERY_MINUTES * MS_PER_MINUTE,
    now
  )
  return {
    billing,
    resources: cached_read(
      async () => {
        await billing().catch(() => null)
        const inventories = await Promise.all(
          [...projects].map(project =>
            compute_inventory(project, { run: bounded_run })
          )
        )
        return { inventories, checked: new Date(now()).toISOString() }
      },
      MS_PER_MINUTE,
      now
    ),
    services: cached_read(
      async () => {
        const rows = await Promise.all(
          clouds.map(async cloud =>
            (await services(cloud, { run: bounded_run })).map(row => ({
              ...row,
              project: cloud.project
            }))
          )
        )
        return { rows: rows.flat() }
      },
      HEALTH_EVERY_MINUTES * MS_PER_MINUTE,
      now
    ),
    plans: cached_read(
      async () =>
        store ? (await import('./watch-traffic.js')).read_plans(store) : null,
      HEALTH_EVERY_MINUTES * MS_PER_MINUTE,
      now
    ),
    traffic: cached_read(
      async () => {
        const refreshed = sync_traffic({
          sync,
          project: traffic_project,
          host: default_host,
          now
        })
        const { read_traffic } = await import('./watch-traffic.js')
        const summary = read_traffic({
          path: default_cache_path(traffic_project, default_host, false),
          now: now()
        })
        return { ...summary, refresh: refreshed }
      },
      TRAFFIC_EVERY_MINUTES * MS_PER_MINUTE,
      now
    )
  }
}
