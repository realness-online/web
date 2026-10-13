import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { after, test } from "node:test"
import { edit_log } from "#root/src/files/edits.js"
import { turn_end, turn_start } from "#root/src/harness/turns.js"

const root = new URL(`../../../../../artifacts/brayness/turns-test-${randomUUID()}/`, import.meta.url).pathname
after(() => rm(root, { recursive: true, force: true }))

const files = async (dir, entries) => {
  for (const [path, body] of Object.entries(entries)) {
    await mkdir(join(dir, path, ".."), { recursive: true })
    await writeFile(join(dir, path), body)
  }
}

test("a turn owns what changed during it, bash deletes included; outside edits stay unexplained", async () => {
  const harness = join(root, "harness")
  const state = join(root, "state")
  await files(harness, {
    "vault/plans/p.md": "## Syncs\n\n- notes\n",
    "notes/gone.md": "g",
    "notes/edited.md": "e",
    "notes/outside.md": "o",
    "notes/node_modules/x.js": "x",
  })
  await writeFile(join(harness, "notes/outside.md"), "edited between turns")

  await turn_start({ root: harness, state, session: "s.jsonl" })
  await rm(join(harness, "notes/gone.md"))
  await writeFile(join(harness, "notes/edited.md"), "edited by a script")
  await files(harness, { "notes/new.md": "n", "notes/node_modules/y.js": "y" })
  const logged = await turn_end({ root: harness, state, session: "s.jsonl", turn: 3 })

  assert.deepEqual(
    logged.map((path) => path.slice(harness.length + 1)),
    ["notes/edited.md", "notes/gone.md", "notes/new.md"],
  )
  const log = edit_log(join(state, "edits.db"))
  assert.ok(log.explained(join(harness, "notes/gone.md"), null))
  assert.equal(log.last(join(harness, "notes/edited.md")).turn, 3)
  assert.equal(log.last(join(harness, "notes/outside.md")), undefined)
  log.close()
})

test("a turn logs a selected single file", async () => {
  const harness = join(root, "single")
  const state = join(root, "single-state")
  await files(harness, { "vault/plans/p.md": "## Syncs\n\n- AGENTS.local.md\n", "AGENTS.local.md": "a" })
  await turn_start({ root: harness, state, session: "s.jsonl" })
  await writeFile(join(harness, "AGENTS.local.md"), "changed")
  const logged = await turn_end({ root: harness, state, session: "s.jsonl", turn: 1 })
  assert.deepEqual(logged, [join(harness, "AGENTS.local.md")])
})

test("turn_end without a turn_start logs nothing", async () => {
  assert.deepEqual(await turn_end({ root, state: join(root, "empty"), session: "none", turn: 0 }), [])
})
