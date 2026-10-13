import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { next_warning, proxy_origin } from "./index.js"

test("each warning shows once per limit per day", () => {
  const shown = new Set()
  const status = { warn: { limit: "day", message: "92% ... pay" } }
  assert.equal(next_warning(status, shown, "2026-10-01"), "92% ... pay")
  assert.equal(next_warning(status, shown, "2026-10-01"), null)
  assert.equal(next_warning({ warn: { limit: "month", message: "m" } }, shown, "2026-10-01"), "m")
  assert.equal(next_warning(status, shown, "2026-10-02"), "92% ... pay")
  assert.equal(next_warning({ warn: null }, shown), null)
})

test("each step of the ramp shows once", () => {
  const shown = new Set()
  const at = (step) => ({ warn: { limit: "day", at: step, message: `${step}%` } })
  assert.equal(next_warning(at(75), shown, "2026-10-01"), "75%")
  assert.equal(next_warning(at(75), shown, "2026-10-01"), null)
  assert.equal(next_warning(at(90), shown, "2026-10-01"), "90%")
  assert.equal(next_warning(at(90), shown, "2026-10-01"), null)
})

test("the proxy origin comes from the brayness provider", () => {
  const scratch = new URL("../../../artifacts/", import.meta.url).pathname
  mkdirSync(scratch, { recursive: true })
  const dir = mkdtempSync(join(scratch, "brayness-limit-"))
  writeFileSync(join(dir, "models.json"), JSON.stringify({ providers: { brayness: { baseUrl: "https://proxy.test/v1" } } }))
  assert.equal(proxy_origin(join(dir, "models.json")), "https://proxy.test")
  assert.equal(proxy_origin(join(dir, "missing.json")), null)
  rmSync(dir, { recursive: true, force: true })
})
