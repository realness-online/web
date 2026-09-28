import assert from "node:assert/strict"
import { test } from "node:test"
import { issue_host_pass, verify_host_pass } from "../src/host-pass.js"
import { issue_host_pass as sync_issue_host_pass } from "../../sync/src/host-pass.js"

const secret = "test-secret-123456789012345678901234567890"
const phone = "+14155550100"
const now = 1_800_000_000_000

/* host/clients/login.js mints its pass with this issuer, so a pass a terminal
   client makes must be one a host accepts. */
test("a pass a host client mints verifies", () => {
  const pass = issue_host_pass({ phone }, secret, now)
  assert.deepEqual(verify_host_pass(pass, secret, now), { phone })
})

/* Two issuers, one format: the sync service mints for a signed-in phone, a
   host client mints from the host secret. Same secret, same claims, same
   bytes - else the two doors drift apart. */
test("the host and sync issuers agree byte for byte", () => {
  assert.equal(issue_host_pass({ phone }, secret, now), sync_issue_host_pass({ phone }, secret, now))
})

test("the issuer refuses what the verifier refuses", () => {
  assert.throws(() => issue_host_pass({ phone: "4155550100" }, secret, now), /verified phone/)
  assert.throws(() => issue_host_pass({}, secret, now), /verified phone/)
  assert.throws(() => issue_host_pass({ phone }, "short", now), /at least 32 bytes/)

  const pass = issue_host_pass({ phone }, secret, now)
  assert.throws(() => verify_host_pass(pass, "another-secret-123456789012345678901234", now), /bad host pass/)
  assert.throws(() => verify_host_pass(pass.replace(/.$/, "x"), secret, now), /bad host pass/)
  assert.throws(() => verify_host_pass(pass, secret, now + 301_000), /expired/)
})
