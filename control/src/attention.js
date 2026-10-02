// o7: what in an overview needs a person. Pure: data in, lines out.
// Each line: { kind, subject, text }. An empty list means all clear.
const pct = (free, total) => (Number(total) > 0 ? (100 * Number(free)) / Number(total) : 100)

export function attention(view, limits, now = Date.now()) {
  const out = []
  const flag = (kind, subject, text) => out.push({ kind, subject, text })
  for (const failed of view.unread ?? []) flag("unread", failed.source, `could not read ${failed.source}: ${failed.error}`)

  for (const { host, age_s, actors } of view.hosts ?? []) {
    if (age_s > limits.stale_s) flag("stale", host.name, `${host.name} last reported ${age_s}s ago`)
    if (host.seed !== "ready") flag("seed", host.name, `${host.name} seed is ${host.seed}`)
    const disk = pct(host.volume_free, host.volume_size)
    if (disk < limits.free_pct) flag("disk", host.name, `${host.name} volume ${disk.toFixed(0)}% free`)
    const memory = pct(host.mem_free, host.mem_total)
    if (memory < limits.free_pct) flag("memory", host.name, `${host.name} memory ${memory.toFixed(0)}% free`)
    for (const actor of actors) {
      const quiet_h = (now - Date.parse(actor.last_activity)) / 3600e3
      if (actor.state === "running" && quiet_h >= limits.quiet_running_h) flag("long", actor.id, `${actor.id} running, quiet ${quiet_h.toFixed(1)}h (owner ${actor.owner || "-"})`)
      if (actor.state === "incomplete") flag("incomplete", actor.id, `${actor.id} on ${host.name} is a half-made actor`)
    }
  }

  for (const loop of view.loops ?? []) {
    const live = loop.status === "running" || loop.status === "starting"
    if (loop.error) flag("loop", loop.id, `loop ${loop.id} error: ${loop.error}`)
    const minutes = (now - Date.parse(loop.started)) / 60e3
    if (live && minutes > limits.loop_deadline_min) flag("long", loop.id, `loop ${loop.id} running ${Math.round(minutes)}m, past its deadline`)
    if (live && Number(loop.depth) >= limits.deep_loop) flag("deep", loop.id, `loop ${loop.id} is ${loop.depth} deep`)
  }

  for (const { name, found, ready } of view.services ?? []) {
    if (!found) flag("service", name, `${name} not deployed`)
    else if (!ready) flag("service", name, `${name} not ready`)
  }
  for (const { service, count, last } of view.errors ?? []) {
    if (count) flag("errors", service, `${service}: ${count} errors in the last hour; latest: ${last}`)
  }
  if (view.spend && view.spend.cost > limits.spend_day) {
    flag("spend", "models", `model spend today $${view.spend.cost.toFixed(2)} over $${limits.spend_day}`)
  }
  for (const gap of view.reconcile?.gaps ?? []) {
    flag("reconcile", gap.span, `models ${gap.span === "day" ? "today" : "this month"}: openrouter $${gap.openrouter.toFixed(4)}, ledger $${gap.ledger.toFixed(4)}`)
  }
  for (const gap of view.bill?.gaps ?? []) {
    if (gap.kind === "spike") flag("bill", gap.day, `gcp spend $${gap.net.toFixed(2)} on ${gap.day}, over twice the 7-day average $${gap.baseline.toFixed(2)}`)
    else flag("bill", gap.service, `gcp charged an unexpected service: ${gap.service}, $${gap.net.toFixed(2)}`)
  }
  return out
}
