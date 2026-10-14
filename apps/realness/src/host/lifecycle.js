import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '#root/lib/units.js'

const MEMORY_MINUTES = 15
const EXPORT_DAYS = 7
export const MEMORY_AFTER = MEMORY_MINUTES * MS_PER_MINUTE
export const RETIRE_AFTER = 2 * MS_PER_HOUR
export const DISK_AFTER = 2 * MS_PER_HOUR
export const EXPORT_AFTER = EXPORT_DAYS * MS_PER_DAY

/** Whether the actor's last final sync happened after its last activity. */
export const synced_since_activity = record => {
  const synced = Date.parse(record.synced_at ?? '')
  const last = Date.parse(record.last_activity ?? record.created)
  return Number.isFinite(synced) && Number.isFinite(last) && synced >= last
}

export const next_step = (
  record,
  now = Date.now(),
  { synced = false } = {}
) => {
  if (!record.owner) return null
  const last = Date.parse(record.last_activity ?? record.created)
  if (!Number.isFinite(last)) return null
  const age = now - last
  if (age < 0) return null
  if (record.state === 'running' && age >= MEMORY_AFTER) return 'memory'
  if (
    synced &&
    record.state !== 'running' &&
    age >= RETIRE_AFTER &&
    synced_since_activity(record)
  )
    return 'retire'
  if (record.state === 'idle' && age >= DISK_AFTER) return 'disk'
  if (record.state === 'stopped' && age >= EXPORT_AFTER) return 'export'
  return null
}
