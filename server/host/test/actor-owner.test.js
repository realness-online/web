import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { ActorStore } from "../src/actors.js"

const root = mkdtempSync(fileURLToPath(new URL("../../../../../artifacts/brayness/owner-test-", import.meta.url)))

test("restore rejects a different owner before reading artifacts or creating a VM", async () => {
  const store = Object.create(ActorStore.prototype)
  store.exportsDir = root
  store.lock = { run: (work) => work() }
  const directory = join(root, "a-export")
  mkdirSync(directory)
  writeFileSync(join(directory, "manifest.json"), JSON.stringify({ actor: { owner: "+14155550123" }, artifacts: { path: "missing.tar.gz" } }))
  try {
    await assert.rejects(store.restore("a-export", "+14155559999"), /export a-export/)
    await assert.rejects(store.restore("a-export", undefined), /export a-export/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
