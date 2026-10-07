import assert from "node:assert/strict"
import { test } from "node:test"
import { argvText, CAPS, macFor, mibFor } from "../src/apps.js"
import { BadRequest, HostError } from "../src/errors.js"

test("an app's MAC carries its 172.17 address", () => {
  assert.equal(macFor("fc-app1"), "06:00:AC:11:01:02")
  assert.equal(macFor("fc-app63"), "06:00:AC:11:3F:02")
  assert.throws(() => macFor("fc-app"), HostError)
})

test("argv is one argument per line, and refuses what would split", () => {
  assert.equal(argvText(["node", "server.js"]), "node\nserver.js\n")
  assert.throws(() => argvText([]), BadRequest)
  assert.throws(() => argvText(["node", "a\nb"]), BadRequest)
  assert.throws(() => argvText(["node", ""]), BadRequest)
})

test("memory sits above the measured handler floor", () => {
  assert.equal(CAPS.vcpus, 1)
  assert.ok(mibFor({ runtime: "node" }) > 64)
  assert.equal(mibFor({ runtime: "node" }, 40), 40)
})
