// o7: the operator's picture, as named sources over the o4 and o5 reads.
// `status` gathers them all once. A later live console can gather each one
// at its own rate (host records often, cost rarely) over the same functions.
import * as reads from "./reads.js"
import * as cloud from "./cloud-reads.js"
import { reconcile_cloud, reconcile_models } from "./reconcile.js"

/** Each source takes { sync, config, now } and returns plain data. */
export const SOURCES = {
  hosts: ({ sync, now }) => reads.hosts(sync, null, now),
  loops: ({ sync }) => reads.loops(sync),
  services: ({ config }) => cloud.services(config.cloud),
  errors: ({ config }) =>
    Promise.all(config.cloud.services.map(async (service) => {
      const rows = await cloud.logs(config.cloud, service, { since: "1h", errors: true, limit: 100 })
      return { service, count: rows.length, last: rows[0]?.text ?? "" }
    })),
  spend: async ({ sync, now }) => {
    const day = new Date(now).toISOString().slice(0, 10)
    const phones = (await sync.ls("can://usage/")).filter((name) => name.endsWith("/")).map((name) => name.slice(0, -1))
    const days = await Promise.all(phones.map((phone) => reads.usage(sync, phone, day)))
    return { day, people: days.filter((d) => d.calls).length, calls: sum(days, "calls"), tokens: sum(days, "tokens"), cost: sum(days, "cost") }
  },
}

// o8: the ledger against OpenRouter, today and this month. Missing setup is a note.
SOURCES.reconcile = async ({ sync, config, now }) => {
  try {
    return await reconcile_models(sync, config, { now })
  } catch (error) {
    if (/no secret|no cloud.openrouter/.test(error.message)) return { setup: error.message }
    throw error
  }
}

// o8: the GCP bill against expected services and spikes. No export is a note.
SOURCES.bill = async ({ config }) => {
  try {
    return await reconcile_cloud(config)
  } catch (error) {
    if (/no billing export|Not found: Table/.test(error.message)) return { setup: error.message.split(";")[0] }
    throw error
  }
}

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0)

/** Read the named sources side by side; a failed one lands in `unread`. */
export async function gather(context, names = Object.keys(SOURCES), sources = SOURCES) {
  const view = { checked: new Date(context.now).toISOString(), unread: [] }
  const results = await Promise.allSettled(names.map((name) => sources[name](context)))
  names.forEach((name, index) => {
    const result = results[index]
    if (result.status === "fulfilled") view[name] = result.value
    else view.unread.push({ source: name, error: result.reason?.message ?? String(result.reason) })
  })
  return view
}

/** One screen: a line per area, attention last. */
export function overview_text(view, lines) {
  const out = []
  for (const { host, age_s, actors } of view.hosts ?? []) {
    out.push(`host ${host.name}: seed ${host.seed}, ${host.actors_running} running, ${actors.length} actors, seen ${age_s}s ago`)
  }
  if (view.loops) out.push(`loops: ${view.loops.filter((l) => l.status === "running").length} running, ${view.loops.length} total`)
  if (view.services) out.push(`services: ${view.services.map((s) => `${s.name} ${s.found ? (s.ready ? "ready" : "NOT READY") : "missing"}`).join(", ")}`)
  if (view.errors) out.push(`log errors (1h): ${view.errors.map((e) => `${e.service} ${e.count}`).join(", ")}`)
  if (view.spend) out.push(`models today: ${view.spend.calls} calls, ${view.spend.tokens} tokens, $${view.spend.cost.toFixed(2)}, ${view.spend.people} people`)
  if (view.reconcile?.setup) out.push(`reconcile: not set up (${view.reconcile.setup})`)
  else if (view.reconcile) out.push(`reconcile: ${view.reconcile.gaps.length ? `${view.reconcile.gaps.length} gaps` : "matches"} (month: ledger $${view.reconcile.ledger.month.toFixed(2)}, openrouter $${view.reconcile.openrouter.month.toFixed(2)})`)
  if (view.bill?.setup) out.push(`gcp bill: not set up (${view.bill.setup})`)
  else if (view.bill) out.push(view.bill.latest ? `gcp bill ${view.bill.latest}: $${view.bill.total.toFixed(2)}, 7-day average $${view.bill.baseline.toFixed(2)}` : "gcp bill: no rows in two weeks")
  out.push(lines.length ? `\nattention (${lines.length}):\n${lines.map((l) => `  ! ${l.text}`).join("\n")}` : "\nattention: none")
  return out.join("\n")
}
