const guest_clock_margin = 0.99

export const execution_interval = (started, ended, duration_ms) => {
  if (
    !Number.isFinite(duration_ms) ||
    duration_ms <= 0 ||
    duration_ms > ended - started
  )
    throw new Error('invalid guest workload duration')
  const duration = duration_ms * guest_clock_margin
  const lower = ended - duration
  const upper = started + duration
  return lower < upper ? [lower, upper] : null
}

export const workload_overlap = intervals => {
  const events = intervals.flatMap(({ name, interval }) =>
    interval
      ? [
          { at: interval[0], name, delta: 1 },
          { at: interval[1], name, delta: -1 }
        ]
      : []
  )
  events.sort((left, right) => left.at - right.at || left.delta - right.delta)
  const active = new Map()
  let maximum = 0
  for (const event of events) {
    const count = (active.get(event.name) ?? 0) + event.delta
    if (count) active.set(event.name, count)
    else active.delete(event.name)
    maximum = Math.max(maximum, active.size)
  }
  return maximum
}
