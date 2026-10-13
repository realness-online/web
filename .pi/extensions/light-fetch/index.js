/**
 * Light fetch (h4): on a light VM, reading a file left in storage fetches it
 * first, so the read sees the real bytes. Inert outside a VM, and on any VM
 * that skipped nothing.
 */
import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

/** The harness path a read names, or null when it falls outside the harness. */
export const harness_path = (root, cwd, path) => {
  const full = resolve(cwd, path.replace(/^@/, ""))
  const inside = relative(root, full)
  return !inside || inside.startsWith("..") || isAbsolute(inside) ? null : inside.split("\\").join("/")
}

export const skipped_list = (state) => {
  const file = join(state, "light.json")
  return existsSync(file) ? new Set(JSON.parse(readFileSync(file, "utf8")).skipped ?? []) : new Set()
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi, { env = process.env, fetch_file = (path) => run("brayness", ["fetch", path], { timeout: 120_000 }) } = {}) {
  if (env.BRAYNESS_ACTOR !== "1") return
  const root = env.BRAYNESS_ROOT ?? "/brayness"
  const state = env.BRAYNESS_STATE ?? join(root, ".pi/agent/state")

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "read" || typeof event.input?.path !== "string") return
    const path = harness_path(root, ctx.cwd, event.input.path)
    if (!path || !skipped_list(state).has(path)) return
    try {
      await fetch_file(path)
    } catch (error) {
      return { block: true, reason: `${path} is in storage and could not be fetched: ${error.message}` }
    }
    if (!existsSync(join(root, path))) return { block: true, reason: `${path} is in storage; fetching it did not bring it here` }
  })
}
