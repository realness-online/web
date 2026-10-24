import { it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mask_phones, redact } from '../../src/control/output.js'

const control = new URL('../../tools/control/', import.meta.url)
const cli = (...args) =>
  JSON.parse(
    execFileSync(process.execPath, ['bin/webspace.js', ...args], {
      cwd: control,
      encoding: 'utf8'
    })
  )

it('halo list returns one JSON result', () => {
  const value = cli('local', 'halo', 'list', '--json')
  assert.equal(typeof value.halo, 'string')
})

it('streamed progress stays off JSON stdout and masks split phones', () => {
  const script = `
    import { stream } from '#root/src/control/exec.js'
    import { set_json_output, result } from '#root/src/control/output.js'
    set_json_output(true)
    await stream(process.execPath, ['-e', 'process.stdout.write("+1415"); setTimeout(() => process.stdout.write("6667777\\\\n"), 10)'])
    result({ ok: true }, '')
  `
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: control, encoding: 'utf8' }
  )
  assert.equal(child.status, 0)
  assert.deepEqual(JSON.parse(child.stdout), { ok: true })
  assert.equal(child.stderr, '+1***77\n')
})

it('JSON help is a result', () => {
  const usage = cli('--help', '--json').usage
  assert.match(usage, /admin login/)
  assert.match(usage, /halo up/)
  assert.doesNotMatch(usage, /compatibility alias/)
})

it('JSON errors mask phone numbers', () => {
  assert.throws(
    () => cli('local', '+14156667777', '--json'),
    error => {
      const value = JSON.parse(error.stdout)
      assert.match(value.error, /\+1\*\*\*77/)
      assert.equal(value.code, 1)
      assert.ok(!value.error.includes('+14156667777'))
      return true
    }
  )
})

it('phone masking covers nested values and keys without changing numbers', () => {
  assert.equal(mask_phones('owner +14156667777'), 'owner +1***77')
  assert.equal(mask_phones('/people/%2B14156667777/x'), '/people/%2B1***77/x')
  assert.deepEqual(
    redact({ '+14156667777': [{ phone: '+442071234567', count: 12 }] }),
    {
      '+1***77': [{ phone: '+4***67', count: 12 }]
    }
  )
})
