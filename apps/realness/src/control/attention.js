import { GIB, MS_PER_HOUR, MS_PER_MINUTE, PERCENT } from '#root/lib/units.js'

const MONEY_PLACES = 4
const pct = (free, total) =>
  Number(total) > 0 ? (PERCENT * Number(free)) / Number(total) : PERCENT
const gb = bytes => (Number(bytes) / GIB).toFixed(2)

const halo_attention = (view, limits, now, flag) => {
  for (const { halo, actors } of view.halos ?? []) {
    if (halo.seed !== 'ready')
      flag('seed', halo.name, `${halo.name} seed is ${halo.seed}`)
    const disk = pct(halo.volume_free, halo.volume_size)
    if (disk < limits.free_pct)
      flag('disk', halo.name, `${halo.name} volume ${disk.toFixed(0)}% free`)
    const memory = pct(halo.mem_free, halo.mem_total)
    if (memory < limits.free_pct)
      flag(
        'memory',
        halo.name,
        `${halo.name} memory ${memory.toFixed(0)}% free`
      )
    const available = Number(halo.mem_available)
    if (
      Number.isFinite(available) &&
      available > 0 &&
      available < limits.mem_available_bytes
    )
      flag(
        'memory',
        halo.name,
        `${halo.name} has ${gb(available)} GiB available`
      )
    const taps_used = Number(halo.actor_taps_used)
    const taps_limit = Number(halo.actor_taps_limit)
    if (Number.isFinite(taps_used) && taps_used >= taps_limit)
      flag(
        'taps',
        halo.name,
        `${halo.name} has no free actor TAP (${taps_used} of ${taps_limit})`
      )
    if (halo.resource_error)
      flag(
        'resources',
        halo.name,
        `${halo.name} cannot read its resources: ${halo.resource_error}`
      )
    for (const actor of actors) {
      const quiet_h = (now - Date.parse(actor.last_activity)) / MS_PER_HOUR
      if (actor.state === 'running' && quiet_h >= limits.quiet_running_h)
        flag(
          'long',
          actor.id,
          `${actor.id} running, quiet ${quiet_h.toFixed(1)}h (owner ${actor.owner || '-'})`
        )
      if (actor.state === 'incomplete')
        flag(
          'incomplete',
          actor.id,
          `${actor.id} on ${halo.name} is a half-made actor`
        )
      if (actor.probe_status === 'failed')
        flag(
          'probe',
          actor.id,
          `${actor.id} on ${halo.name} did not answer: ${actor.probe_error || 'no response'}`
        )
    }
  }
}

const loop_attention = (view, limits, now, flag) => {
  for (const loop of view.loops ?? []) {
    const live = loop.status === 'running' || loop.status === 'starting'
    if (loop.error)
      flag('loop', loop.id, `loop ${loop.id} error: ${loop.error}`)
    const minutes = (now - Date.parse(loop.started)) / MS_PER_MINUTE
    if (live && minutes > limits.loop_deadline_min)
      flag(
        'long',
        loop.id,
        `loop ${loop.id} running ${Math.round(minutes)}m, past its deadline`
      )
    if (live && Number(loop.depth) >= limits.deep_loop)
      flag('deep', loop.id, `loop ${loop.id} is ${loop.depth} deep`)
  }
}

export const attention = (view, limits, now = Date.now()) => {
  const out = []
  const flag = (kind, subject, text) => out.push({ kind, subject, text })
  for (const failed of view.unread ?? [])
    flag(
      'unread',
      failed.source,
      `could not read ${failed.source}: ${failed.error}`
    )

  halo_attention(view, limits, now, flag)

  if (view.quiet?.setup)
    flag('watch', 'halos', `halo health is not reported: ${view.quiet.setup}`)
  for (const quiet of view.quiet?.quiet ?? [])
    flag(
      'down',
      quiet.name,
      `${quiet.name} stopped reporting${quiet.age_s === null ? ' (no readable time)' : ` (${quiet.age_s}s ago)`}`
    )

  loop_attention(view, limits, now, flag)

  for (const { name, found, ready } of view.services ?? [])
    if (!found) flag('service', name, `${name} not deployed`)
    else if (!ready) flag('service', name, `${name} not ready`)

  for (const { service, count, last } of view.errors ?? [])
    if (count)
      flag(
        'errors',
        service,
        `${service}: ${count} errors in the last hour; latest: ${last}`
      )

  if (view.spend && view.spend.cost > limits.spend_day)
    flag(
      'spend',
      'models',
      `model spend today $${view.spend.cost.toFixed(2)} over $${limits.spend_day}`
    )

  for (const gap of view.reconcile?.gaps ?? [])
    flag(
      'reconcile',
      gap.span,
      `models ${gap.span === 'day' ? 'today' : 'this month'}: openrouter $${gap.openrouter.toFixed(MONEY_PLACES)}, ledger $${gap.ledger.toFixed(MONEY_PLACES)}`
    )

  for (const gap of view.bill?.gaps ?? [])
    if (gap.kind === 'spike')
      flag(
        'bill',
        gap.day,
        `gcp spend $${gap.net.toFixed(2)} on ${gap.day}, over twice the 7-day average $${gap.baseline.toFixed(2)}`
      )
    else
      flag(
        'bill',
        gap.service,
        `gcp charged an unexpected service: ${gap.service}, $${gap.net.toFixed(2)}`
      )

  return out
}
