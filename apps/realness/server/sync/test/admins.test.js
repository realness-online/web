import assert from "node:assert/strict"
import { test } from "node:test"
import { admins, read_admins } from "../../../src/sync/admins.js"

test("admins are tel: links; anything else is ignored", () => {
  const html = '<a href="tel:+14156667777">Scott</a> +14155550123 <a href="tel:12345">bad</a>'
  assert.deepEqual([...read_admins(html)], ["+14156667777"])
})

test("the list is read at most every 30 seconds; none means no admins", async () => {
  let reads = 0
  let page = null
  let clock = 0
  const list = admins({ get: async () => (reads++, page) }, { now: () => clock })
  assert.equal(await list.has("+14156667777"), false)
  page = { body: Buffer.from('<a href="tel:+14156667777">Scott</a>') }
  assert.equal(await list.has("+14156667777"), false)
  clock = 30_000
  assert.equal(await list.has("+14156667777"), true)
  assert.equal(reads, 2)
})
