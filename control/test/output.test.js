import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mask_phones, redact } from "../src/output.js"

const cli = (...args) => JSON.parse(execFileSync(process.execPath, ["bin/webspace.js", ...args], { encoding: "utf8" }))

test("JSON host list contains only one result despite progress", () => {
  const value = cli("dev", "host", "list", "--json")
  assert.equal(typeof value.host, "string")
})

test("streamed progress stays off JSON stdout and masks split phones", () => {
  const script = `
    import { stream } from './src/exec.js'
    import { set_json_output, result } from './src/output.js'
    set_json_output(true)
    await stream(process.execPath, ['-e', 'process.stdout.write("+1415"); setTimeout(() => process.stdout.write("6667777\\\\n"), 10)'])
    result({ ok: true }, '')
  `
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" })
  assert.equal(child.status, 0)
  assert.deepEqual(JSON.parse(child.stdout), { ok: true })
  assert.equal(child.stderr, "+1***77\n")
})

test("JSON help is a result", () => {
  assert.match(cli("--help", "--json").usage, /admin login/)
})

test("JSON errors mask phone numbers", () => {
  assert.throws(() => cli("dev", "+14156667777", "--json"), (error) => {
    const value = JSON.parse(error.stdout)
    assert.match(value.error, /\+1\*\*\*77/)
    assert.equal(value.code, 1)
    assert.ok(!value.error.includes("+14156667777"))
    return true
  })
})

test("phone masking covers nested values and keys without changing numbers", () => {
  assert.equal(mask_phones("owner +14156667777"), "owner +1***77")
  assert.equal(mask_phones("/people/%2B14156667777/x"), "/people/%2B1***77/x")
  assert.deepEqual(redact({ "+14156667777": [{ phone: "+442071234567", count: 12 }] }), {
    "+1***77": [{ phone: "+4***67", count: 12 }],
  })
})
