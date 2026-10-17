import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { itemid_of, served, stale_plans } from "./index.js"

const ROOT = join(import.meta.dirname, "../../..")

const scratch = () => {
  const dir = join(ROOT, "artifacts/plan-render")
  mkdirSync(dir, { recursive: true })
  return mkdtempSync(join(dir, "test-"))
}

test("itemid_of reads the front matter id", () => {
  assert.equal(itemid_of('---\nitemid: "/+1/plans/2"\n---\n# x'), "/+1/plans/2")
  assert.equal(itemid_of("# no front matter"), null)
})

test("stale_plans finds plans newer than their page", () => {
  const dir = scratch()
  const folder = join(dir, "plans")
  const dist = join(dir, "dist")
  mkdirSync(folder)
  mkdirSync(join(dist, "+1/plans/2"), { recursive: true })
  const plan = join(folder, "a.md")
  const page = join(dist, "+1/plans/2/index.html")
  writeFileSync(plan, '---\nitemid: "/+1/plans/2"\n---\n')
  writeFileSync(page, "<p>a</p>")
  utimesSync(page, 1000, 1000)
  utimesSync(plan, 2000, 2000)
  assert.deepEqual(stale_plans(folder, dist).map((p) => p.name), ["a.md"])
  utimesSync(page, 3000, 3000)
  assert.deepEqual(stale_plans(folder, dist), [])
})

test("served reports a matching, differing, and missing server", async () => {
  const dir = scratch()
  const page = join(dir, "index.html")
  writeFileSync(page, "<p>a</p>")
  const plan = { itemid: "/+1/plans/2", page }
  const answer = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 404, text: async () => body })
  assert.equal(await served(plan, answer("<p>a</p>")), null)
  assert.match(await served(plan, answer("<p>old</p>")), /differs/)
  assert.match(await served(plan, answer("", false)), /404/)
  assert.match(
    await served(plan, async () => {
      throw new Error("refused")
    }),
    /no plans server/,
  )
})
