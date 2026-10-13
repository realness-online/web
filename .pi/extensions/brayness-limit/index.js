/**
 * Brayness limit: near a model-use limit, say so in Pi and offer a way to pay.
 *
 * After each reply, asks the brayness proxy's `/limit` under a fresh model
 * pass. The proxy decides whether to warn (at 75%, 90%, and the 100% cutoff) and words the
 * message; this shows each step once per limit per day. Inert outside a hosted
 * guest.
 */
import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const GUEST = "/etc/brayness"

/** The proxy's origin, from the brayness provider in models.json. */
export function proxy_origin(models_path = join(homedir(), ".pi/agent/models.json")) {
  try {
    return new URL(JSON.parse(readFileSync(models_path, "utf8")).providers.brayness.baseUrl).origin
  } catch {
    return null
  }
}

const model_pass = () =>
  new Promise((resolve, reject) =>
    execFile("brayness-model-pass", { timeout: 10_000 }, (error, stdout) => (error ? reject(error) : resolve(stdout.trim()))),
  )

/** A warning worth showing now, or null; `shown` remembers what was. */
export function next_warning(status, shown, today = new Date().toISOString().slice(0, 10)) {
  const warn = status?.warn
  if (!warn?.message) return null
  const key = `${today} ${warn.limit} ${warn.at ?? ""}`
  if (shown.has(key)) return null
  shown.add(key)
  return warn.message
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi) {
  if (!existsSync(GUEST)) return
  const origin = proxy_origin()
  if (!origin) return
  const shown = new Set()
  pi.on("agent_end", async (_event, ctx) => {
    try {
      const reply = await fetch(`${origin}/limit`, { headers: { authorization: `Bearer ${await model_pass()}` }, signal: AbortSignal.timeout(5000) })
      if (!reply.ok) return
      const message = next_warning(await reply.json(), shown)
      if (message) ctx.ui.notify(message, "warning")
    } catch {}
  })
}
