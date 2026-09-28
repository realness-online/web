import assert from "node:assert/strict"
import { test } from "node:test"
import { argvText, CAPS, macFor } from "../src/apps.js"
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

test("every cap is named, with a default", () => {
  assert.deepEqual(Object.keys(CAPS).sort(), ["mib", "vcpus"])
  assert.ok(CAPS.mib > 0 && CAPS.vcpus > 0)
})
