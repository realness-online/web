import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import footer_filter, { DEFAULT_HIDDEN, filter_provider, hidden_keys } from "./index.js"

const scratch = join(process.cwd(), "artifacts/footer-filter")

const provider = () => {
  const statuses = new Map()
  return {
    statuses,
    getExtensionStatuses: () => statuses,
    setExtensionStatus(key, text) {
      if (text === undefined) statuses.delete(key)
      else statuses.set(key, text)
    },
  }
}

describe("hidden_keys", () => {
  it("reads footer.hideStatuses from settings", () => {
    mkdirSync(scratch, { recursive: true })
    const path = join(scratch, "settings.json")
    writeFileSync(path, JSON.stringify({ footer: { hideStatuses: ["rewind"] } }))
    assert.deepEqual([...hidden_keys(path)], ["rewind"])
  })

  it("falls back to the default list", () => {
    assert.deepEqual([...hidden_keys(join(scratch, "missing.json"))], DEFAULT_HIDDEN)
  })
})

describe("filter_provider", () => {
  it("drops hidden keys already set and set later, keeps the rest", () => {
    const data = provider()
    data.setExtensionStatus("claude-oauth-ready", "✓ Claude OAuth ready")
    filter_provider(data, new Set(["claude-oauth-ready"]))
    data.setExtensionStatus("claude-oauth-ready", "✓ Claude OAuth active")
    data.setExtensionStatus("claude-oauth-issue", "limit")
    assert.deepEqual([...data.statuses], [["claude-oauth-issue", "limit"]])
  })
})

describe("extension", () => {
  it("filters through setFooter and restores the built-in footer", async () => {
    const data = provider()
    const calls = []
    let start
    footer_filter({ on: (name, handler) => name === "session_start" && (start = handler) })
    await start({}, {
      hasUI: true,
      ui: { setFooter: (factory) => { calls.push(Boolean(factory)); factory?.(null, null, data) } },
    })
    data.setExtensionStatus("claude-oauth-ready", "✓")
    assert.deepEqual(calls, [true, false])
    assert.equal(data.statuses.size, 0)
  })
})
