import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { contract } from "../src/contract.js"
import { disk } from "../src/disk.js"

const base = new URL(`../../dist/can-store-test-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(base, { recursive: true, force: true }))

contract({ test, assert, make: async () => disk(`${base}${randomUUID()}`) })

test("disk refuses keys that escape its root", async () => {
  const store = disk(`${base}${randomUUID()}`)
  await assert.rejects(store.put("../outside", "x"), /escapes the root/)
  await assert.rejects(store.get("people/../../outside"), /escapes the root/)
})
