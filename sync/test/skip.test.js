import assert from "node:assert/strict"
import { test } from "node:test"
import { skipped } from "../src/skip.js"

test("dependencies, builds, auth, secrets, and git never sync", () => {
  for (const path of [
    "app/node_modules/x/index.js", "app/dist/a.js", ".git/HEAD", "work/app/.env",
    ".env.local", "keys/server.pem", ".ssh/id_ed25519", ".pi/agent/auth.json", "a/.npmrc",
  ])
    assert.ok(skipped(path), path)
})

test("ordinary files sync", () => {
  for (const path of ["vault/note.md", "plans/brayness.md", "posters/1.html.gz", "src/environment.js", "keyboard.md"])
    assert.ok(!skipped(path), path)
})
