import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { contract } from "../src/contract.js"
import { disk } from "../src/disk.js"

const base = new URL(`../../../../artifacts/brayness/can-store-test-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(base, { recursive: true, force: true }))

contract({ test, assert, make: async () => disk(`${base}${randomUUID()}`) })

test("disk writes and composes names near the filesystem limit", async () => {
  const store = disk(`${base}${randomUUID()}`)
  const key = `vault/${"n".repeat(240)}.md`
  await store.put(key, "first")
  assert.equal((await store.get(key)).body.toString(), "first")
  await store.put("part", "second")
  await store.compose(key, [key, "part"])
  assert.equal((await store.get(key)).body.toString(), "firstsecond")
})

test("disk refuses keys that escape its root", async () => {
  const store = disk(`${base}${randomUUID()}`)
  await assert.rejects(store.put("../outside", "x"), /escapes the root/)
  await assert.rejects(store.get("people/../../outside"), /escapes the root/)
})
