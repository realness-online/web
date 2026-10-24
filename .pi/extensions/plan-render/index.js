/**
 * Plan render: keeps the browser's plans current without relying on memory.
 *
 * After every tool result, any plan in the plans folder newer than its built
 * page is rebuilt with `bin/plans/plans.js`, then fetched from the plans server and
 * compared with the build. The outcome is appended to that tool result, so a
 * stale or unserved plan is reported in the same turn it was edited.
 */
import { execFile } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import { plans_path } from "../../../bin/lib/harness-settings.js"

const run = promisify(execFile)
const ROOT = join(import.meta.dirname, "../../..")
const DIST = join(ROOT, "artifacts/apps/plans/dist")
const SERVER = `http://127.0.0.1:${process.env.PLANS_PORT ?? 4323}`

/**
 * The itemid in a plan's front matter, e.g. `/+1628.../plans/1785...`.
 * @param {string} text
 */
export const itemid_of = (text) => text.match(/^itemid:\s*"?([^"\n]+)"?\s*$/m)?.[1] ?? null

/**
 * Plans whose source is newer than their built page.
 * @param {string} folder
 * @param {string} dist
 */
export const stale_plans = (folder, dist) => {
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const file = join(folder, name)
      const itemid = itemid_of(readFileSync(file, "utf8"))
      if (!itemid) return null
      const page = join(dist, itemid, "index.html")
      const built = existsSync(page) ? statSync(page).mtimeMs : 0
      return statSync(file).mtimeMs > built ? { name, itemid, page } : null
    })
    .filter(Boolean)
}

/**
 * Whether the server returns the built page byte for byte.
 * @param {{ itemid: string; page: string; }} plan
 * @param {typeof fetch} get
 */
export const served = async (plan, get = fetch) => {
  try {
    const response = await get(`${SERVER}${plan.itemid}/`)
    if (!response.ok) return `server returned ${response.status}`
    return (await response.text()) === readFileSync(plan.page, "utf8") ? null : "server page differs from the build"
  } catch {
    return `no plans server at ${SERVER}; run npm run vault:serve`
  }
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function (pi) {
  const folder = join(ROOT, plans_path(ROOT))
  let building = null
  pi.on("tool_result", async (event) => {
    if (building) await building
    const stale = stale_plans(folder, DIST)
    if (!stale.length) return
    building = run(process.execPath, [join(ROOT, "bin/plans/plans.js")], { cwd: ROOT, timeout: 120_000 })
    let note
    try {
      await building
      const checks = await Promise.all(stale.map(async (plan) => [plan, await served(plan)]))
      note = checks
        .map(([plan, problem]) => (problem ? `plan-render: ${plan.name} NOT in browser: ${problem}` : `plan-render: ${plan.name} rebuilt and served at ${SERVER}${plan.itemid}/`))
        .join("\n")
    } catch (error) {
      note = `plan-render: build failed: ${error.stderr || error.message}`
    } finally {
      building = null
    }
    return { content: [...(event.content ?? []), { type: "text", text: note }] }
  })
}
