// Local retention until actor sync proves remote restore.
export const MEMORY_AFTER = 15 * 60 * 1000
export const DISK_AFTER = 2 * 60 * 60 * 1000
export const EXPORT_AFTER = 7 * 24 * 60 * 60 * 1000

export const next_step = (record, now = Date.now()) => {
  if (!record.owner) return null // Do not retire actors without verified ownership.
  const last = Date.parse(record.last_activity ?? record.created)
  if (!Number.isFinite(last)) return null
  const age = now - last
  if (age < 0) return null
  if (record.state === "running" && age >= MEMORY_AFTER) return "memory"
  if (record.state === "idle" && age >= DISK_AFTER) return "disk"
  if (record.state === "stopped" && age >= EXPORT_AFTER) return "export"
  return null
}
