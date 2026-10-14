import {
  compute_inventory,
  month_cost,
  services
} from '#root/src/control/cloud-reads.js'
import { ENVIRONMENTS } from '#root/tools/control/webspace.config.js'
import { attempt } from '#root/src/control/exec.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'

const SPEND_EVERY_MINUTES = 15
const HEALTH_EVERY_MINUTES = 5

/** Cache slow reads, including failures, so refresh keys do not run paid queries. */
export const cached_read = (read, interval_ms, now = Date.now) => {
  let next = 0
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

/** Billing covers configured exports; inventory includes their billed projects. */
export const cloud_sources = ({
  environments = ENVIRONMENTS,
  run = attempt,
  now = Date.now
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
    )
  }
}
