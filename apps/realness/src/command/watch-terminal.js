
const ESC = "\x1b["
const RESET = `${ESC}0m`

const COLORS = {
  running: "32",
  sleeping: "34",
  idle: "33",
  quiet: "35",
  failed: "31",
  unknown: "90",
}

export const color_enabled = (env = process.env, stream = process.stdout) =>
  env.NO_COLOR !== "1" && stream.isTTY !== false && env.TERM !== "dumb"

/** Wrap text in a state color; unknown and quiet are dim. */
export const paint = (text, state, on = true) => (on && COLORS[state] ? `${ESC}${COLORS[state]}m${text}${RESET}` : String(text))

const width_of = (text) => [...text.replace(/\x1b\[[0-9;]*m/g, "")].length

const fit = (text, width) => {
  if (width_of(text) <= width) return text
  const chars = [...text.replace(/\x1b\[[0-9;]*m/g, "")]
  return chars.slice(0, Math.max(0, width - 1)).join("") + "…"
}

/** Clip a row to the terminal, so a long line never wraps into the next. */
const clip = (text, width) => (width_of(text) <= width ? text : fit(text, width))

/** A dim label above clipped data rows, with no filled background. */
export const panel = ({ title, detail = "", lines = [], width = 40, on = true }) => {
  const inner = Math.max(8, width - 2)
  const head = `${title}${detail ? ` ${detail}` : ""}`
  const out = [paint(fit(head, inner), "unknown", on)]
  for (const line of lines) out.push(clip(line, inner))
  return out
}

const age = (seconds) => (seconds === null || seconds === undefined ? "-" : seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`)

const usd = (value) => `$${Number(value).toFixed(2)}`

/** Wrap long paths instead of hiding their ends. */
const wrap = (text, width) => {
  const rows = []
  const chars = [...String(text)]
  for (let at = 0; at < chars.length; at += Math.max(1, width)) rows.push(chars.slice(at, at + Math.max(1, width)).join(""))
  return rows.length ? rows : [""]
}

/** Relative bars show cost drivers; the dollar values remain exact to cents. */
export const cost_bars = (rows, width = 100) => {
  const sums = new Map()
  for (const row of rows) sums.set(row.service, (sums.get(row.service) ?? 0) + row.net)
  const costs = [...sums].filter(([, cost]) => cost !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  if (!costs.length) return ["No net charges recorded"]
  const shown = costs.slice(0, 5)
  if (costs.length > 5) shown.push(["Other", costs.slice(5).reduce((sum, [, cost]) => sum + cost, 0)])
  const label_width = Math.min(Math.max(...shown.map(([label]) => label.length)), Math.max(8, Math.floor(width * 0.35)))
  const money_width = Math.max(...shown.map(([, cost]) => usd(cost).length))
  const bar_width = Math.max(1, width - label_width - money_width - 3)
  const maximum = Math.max(...shown.map(([, cost]) => Math.abs(cost)))
  return shown.map(([label, cost]) => `${fit(label, label_width).padEnd(label_width)} ${usd(cost).padStart(money_width)} ${cost === 0 ? "" : (cost < 0 ? "-" : "#").repeat(Math.max(1, Math.round(Math.abs(cost) / maximum * bar_width)))}`)
}

export const billing_lines = (result, width = 100, on = true, now = Date.now()) => {
  if (result?.status !== "ok") return [paint("UNAVAILABLE - cloud bill not included", "failed", on)]
  const exports = result.exports ?? []
  if (!exports.length) return [paint("UNAVAILABLE - no billing export data", "failed", on)]
  const total = exports.reduce((sum, bill) => sum + bill.total, 0)
  const through = Math.min(...exports.map((bill) => Date.parse(bill.through)))
  const days = new Map()
  for (const bill of exports) for (const day of bill.daily ?? []) days.set(day.date, (days.get(day.date) ?? 0) + day.cost)
  const daily = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date, cost }))
  return [
    `MONTH ${usd(total)}  cloud charges after credits`,
    `Billing ${age(Math.max(0, Math.floor((now - through) / 1000)))} behind; latest day may be incomplete`,
    ...spend_chart(daily, width),
    "",
    "Largest costs this month",
    ...cost_bars(exports.flatMap((bill) => bill.rows), width),
  ]
}

export const resource_lines = (result, width = 100, on = true) => {
  if (result?.status !== "ok") return [paint("UNAVAILABLE - cloud machine and disk state", "failed", on)]
  const inventories = result.inventories ?? []
  const instances = inventories.flatMap((item) => item.instances)
  const disks = inventories.flatMap((item) => item.disks)
  const running = instances.filter((row) => row.status === "RUNNING").length
  const stopped = instances.filter((row) => row.status === "TERMINATED").length
  const lines = [`${running} running cloud machines  ${stopped} stopped`]
  for (const row of instances) {
    const state = row.status === "TERMINATED" ? "STOPPED" : row.status
    lines.push(...wrap(`${row.name}  ${state}`, width).map((line) => paint(line, row.status === "TERMINATED" ? "sleeping" : "idle", on)))
  }
  const size = disks.reduce((sum, row) => sum + row.size_gb, 0)
  lines.push(disks.length ? `${disks.length} disks / ${size} GB retained - storage charges continue` : "No persistent disks found")
  const unattached = disks.filter((disk) => !disk.attached.length)
  if (unattached.length) lines.push(paint(`${unattached.length} disks are unattached`, "idle", on))
  return lines
}

export const service_lines = (result, width = 100, on = true) => {
  if (result?.status !== "ok") return [paint("UNAVAILABLE - cloud service status", "failed", on), ...wrap(result?.error ?? "no service source", width)]
  return (result.rows ?? []).flatMap((row) => wrap(`${row.name}  ${row.found ? row.ready ? "ready" : "NOT READY" : "MISSING"}  ${row.project}`, width).map((line) => paint(line, row.found && row.ready ? "running" : "failed", on)))
}

const count = (value) => (value === null || value === undefined ? "-" : String(value))

export const host_lines = (rows = [], on = true) =>
  rows.length
    ? rows.map((row) => {
      const actors = row.actors ? `${row.actors.running} running, ${row.actors.idle} idle, ${row.actors.stopped} stopped` : "-"
      const text = `${row.name}  ${row.state}  report ${age(row.age_s)} ago  ${actors}`
      return `${paint(text, row.state, on)}${row.detail ? paint(`  ${row.detail}`, "unknown", on) : ""}`
    })
    : ["no host records"]

export const cost_lines = (rows = [], on = true) =>
  rows.length
    ? rows.map((row) => {
      const label = `${row.phone.slice(0, 5)}…${row.phone.slice(-3)}${row.named ? " *" : ""}`
      return `${fit(label, 16)} ${usd(row.day.cost)} day  ${usd(row.month.cost)} month`
    })
    : ["no ledger for this token"]

/** Daily cost bars share a zero baseline; narrow views sum adjacent days. */
export const spend_chart = (daily = [], width = 80) => {
  if (!daily.length) return ["daily history unavailable"]
  const height = 4
  const peak = Math.max(...daily.map((day) => Math.abs(day.cost)), 0)
  const label = usd(peak)
  const available = Math.max(1, width - label.length - 3)
  const stride = Math.max(1, Math.ceil(daily.length / available))
  const bins = []
  for (let at = 0; at < daily.length; at += stride) bins.push(daily.slice(at, at + stride).reduce((sum, day) => sum + day.cost, 0))
  const maximum = Math.max(...bins.map(Math.abs), 0)
  const positive_peak = Math.max(...bins, 0)
  const negative_peak = Math.min(...bins, 0)
  const spacing = bins.length * 2 - 1 <= available ? " " : ""
  const rows = []
  for (let level = height; level > 0; level--) {
    const axis = level === height ? usd(positive_peak) : ""
    const bars = bins.map((cost) => cost > 0 && Math.ceil(cost / maximum * height) >= level ? "#" : " ").join(spacing)
    rows.push(`${axis.padStart(label.length)} | ${bars}`)
  }
  rows.push(`${"$0".padStart(label.length)} + ${"-".repeat(bins.length + spacing.length * (bins.length - 1))}`)
  if (negative_peak < 0) {
    for (let level = 1; level <= height; level++) {
      const axis = level === height ? usd(negative_peak) : ""
      const bars = bins.map((cost) => cost < 0 && Math.ceil(Math.abs(cost) / maximum * height) >= level ? "-" : " ").join(spacing)
      rows.push(`${axis.padStart(label.length)} | ${bars}`)
    }
  }
  rows.push(`${daily[0].date.slice(5)} to ${daily.at(-1).date.slice(5)}${stride > 1 ? `; ${stride}-day totals` : "; daily"}`)
  return rows
}

export const spend_lines = (rows = [], width = 80) => rows.length
  ? rows.flatMap((row) => [
    `${row.phone.slice(0, 5)}...${row.phone.slice(-3)}  TODAY ${usd(row.day.cost)}  MONTH ${usd(row.month.cost)}`,
    ...(row.daily?.some((day) => day.cost !== 0) ? spend_chart(row.daily, width) : [row.daily?.length ? "No recorded model cost this month" : "daily history unavailable"]),
  ])
  : ["no ledger for this token"]

export const sync_lines = (rows = [], on = true, width = 100) => {
  if (!rows.length) return ["no folders configured"]
  const unread = rows.filter((row) => !row.listing)
  const missing = rows.filter((row) => row.listing && !row.last_sync)
  const lines = [`${rows.length - unread.length}/${rows.length} folders readable; ${missing.length} without a local sync record`]
  for (const row of unread) lines.push(...wrap(`Cannot read: ${row.folder}`, width).map((line) => paint(line, "failed", on)))
  for (const row of missing) lines.push(...wrap(`No local sync record: ${row.folder}`, width))
  return lines
}

export const sign_on_lines = (info) =>
  info?.rows?.length
    ? info.rows.map((row) => `signed in  ${row.phone}  ${row.expires_at ? `until ${row.expires_at.slice(11, 19)}Z` : "no expiry"}`)
    : [info?.detail ?? "not signed in"]

export const publish_lines = (rows = []) =>
  rows.length ? rows.map((row) => `${row.phone}  sites ${count(row.sites)}${row.detail ? `  ${row.detail}` : ""}`) : ["nothing published"]

const error_lines = (panel_result, on = true) =>
  panel_result?.status === "failed" ? [paint(`FAILED ${panel_result.error}`, "failed", on), paint(`last read ${panel_result.at?.slice(11, 19) ?? "-"}Z`, "unknown", on)] : []

/** Ordered monitor rows, shared by rendering and scroll bounds. */
export const frame_rows = (snapshot, width = 100, on = true, details = false, now = Date.now()) => {
  const panels = snapshot?.panels ?? {}
  const rows = []
  const section = (title, lines) => rows.push(paint(title, "unknown", on), ...lines.map((line) => clip(line, width)), "")
  if (details) {
    const billing = panels.billing
    const scope = (billing?.exports ?? []).flatMap((bill) => [
      ...wrap(`Export: ${bill.table}`, width),
      `Usage through ${bill.through}; queried ${bill.checked}`,
    ])
    section("BILLING DETAILS", error_lines(billing, on).concat(scope))
    section("CLOUD SERVICES", error_lines(panels.services, on).concat(service_lines(panels.services, width, on)))
    const resources = (panels.resources?.inventories ?? []).flatMap((inventory) => [
      ...inventory.instances.map((row) => `${row.name}  ${row.status}  ${row.machine}  ${inventory.project}`),
      ...inventory.disks.map((row) => `${row.name}  ${row.size_gb} GB  ${row.attached.length ? row.attached.join(", ") : "unattached"}`),
    ])
    const inventories = panels.resources?.inventories ?? []
    const inventory_summary = panels.resources?.status === "ok"
      ? `Cloud inventory: ${inventories.reduce((sum, item) => sum + item.instances.length, 0)} machines, ${inventories.reduce((sum, item) => sum + item.disks.length, 0)} disks`
      : "Cloud inventory unavailable"
    section("CLOUD RESOURCE DETAILS", [inventory_summary, ...error_lines(panels.resources, on), ...resources])
    const reports = (panels.hosts?.rows ?? []).map((row) => paint(`${row.name}  ${row.age_s === null || row.age_s === undefined ? "no dated agent report" : `last agent report ${age(row.age_s)} ago`}`, "unknown", on))
    section("AGENT REPORT HISTORY", error_lines(panels.hosts, on).concat(reports))
    section("MODEL SPEND - account ledger only", error_lines(panels.cost, on).concat(spend_lines(panels.cost?.rows, width)))
    section("SYNC", error_lines(panels.sync, on).concat(sync_lines(panels.sync?.rows, on, width)))
    rows.push(...error_lines(panels.sign_on, on), ...error_lines(panels.publish, on), ...sign_on_lines(panels.sign_on), ...publish_lines(panels.publish?.rows))
    return rows
  }
  section("CLOUD BILLING", billing_lines(panels.billing, width, on, now))
  const checked = Date.parse(panels.resources?.checked ?? "")
  const resource_age = Number.isFinite(checked) ? `  read ${age(Math.max(0, Math.floor((now - checked) / 1000)))} ago` : ""
  section(`CLOUD MACHINES${resource_age}`, resource_lines(panels.resources, width, on))
  const status = []
  if (panels.services?.status !== "ok") status.push(paint("Cloud service status unavailable", "failed", on))
  else {
    const services = panels.services.rows ?? []
    const problems = services.filter((row) => !row.found || !row.ready)
    if (!problems.length) status.push(`${services.length} cloud services ready`)
    for (const row of problems) status.push(paint(`${row.name}: ${row.found ? "NOT READY" : "MISSING"}`, "failed", on))
  }
  if (panels.sync?.status === "failed") status.push(paint("Sync read failed - see details", "failed", on))
  else for (const row of panels.sync?.rows ?? []) if (!row.listing) status.push(...wrap(`Cannot read sync folder: ${row.folder}`, width))
  const running = new Set((panels.resources?.inventories ?? []).flatMap((inventory) => inventory.instances.filter((row) => row.status === "RUNNING").map((row) => row.name)))
  for (const row of panels.hosts?.rows ?? []) if (running.has(row.name) && row.state === "quiet") status.push(paint(`${row.name}: cloud machine running, agent report missing`, "idle", on))
  if (panels.cost?.status === "failed") status.push("Model cost unavailable - see details")
  section("STATUS", status)
  const model_cost = panels.cost?.rows ?? []
  if (model_cost.some((row) => row.month.cost !== 0)) section("MODEL SPEND - separate from cloud", [
    `TODAY ${usd(model_cost.reduce((sum, row) => sum + row.day.cost, 0))}  MONTH ${usd(model_cost.reduce((sum, row) => sum + row.month.cost, 0))}`,
  ])
  return rows
}

/** Billing first, with scrollable sections and a fixed control footer. */
export const frame = ({ snapshot, width = 100, height = 30, interval_ms = 60_000, now = Date.now(), on = true, message = null, offset = 0, details = false }) => {
  const rows = frame_rows(snapshot, width, on, details, now)
  const capacity = Math.max(0, height - 5)
  const start = Math.min(offset, Math.max(0, rows.length - capacity))
  const body = rows.slice(start, start + capacity).map((line) => clip(line, width))
  const head = `${paint("BRAYNESS SERVICE WATCH", "running", on)}  ${details ? "details" : "costs"}  every ${Math.round(interval_ms / 1000)}s${message ? `  ${paint(message, "idle", on)}` : ""}`
  const position = rows.length > capacity ? `rows ${start + 1}-${start + body.length}/${rows.length}  j/k scroll` : ""
  const footer = paint(`^C quit  r refresh  d ${details ? "costs" : "details"}  u 15s  m 60s  h 5m  ${position}`, "unknown", on)
  return [fit(head, width), "", ...body, "", fit(footer, width)].join("\n") + "\n"
}

/** Reads one keypress without echoing it; resolves null on any other input. */
export const read_key = async (input = process.stdin, signal = null) => {
  if (signal?.aborted) return null
  if (input.setRawMode) input.setRawMode(true)
  input.resume()
  return new Promise((resolve) => {
    const done = (value) => {
      input.off("data", on_data)
      signal?.removeEventListener("abort", on_abort)
      resolve(value)
    }
    const on_data = (chunk) => done(chunk.toString("utf8"))
    const on_abort = () => done(null)
    input.on("data", on_data)
    signal?.addEventListener("abort", on_abort, { once: true })
  })
}

/** How long `key` should hold the next redraw, or null to keep the interval. */
export const interval_for = (key, current_ms) => {
  if (key === "u") return 15_000
  if (key === "m") return 60_000
  if (key === "h") return 300_000
  return current_ms
}