import assert from 'node:assert/strict'
import { it } from 'node:test'
import { argv_text, CAPS, mac_for, mib_for } from '../../src/halo/apps.js'
import { BadRequest, HaloError } from '../../src/halo/errors.js'

it("an app's MAC carries its 172.17 address", () => {
  assert.equal(mac_for('fc-app1'), '06:00:AC:11:01:02')
  assert.equal(mac_for('fc-app63'), '06:00:AC:11:3F:02')
  assert.throws(() => mac_for('fc-app'), HaloError)
})

it('argv is one argument per line, and refuses what would split', () => {
  assert.equal(argv_text(['node', 'server.js']), 'node\nserver.js\n')
  assert.throws(() => argv_text([]), BadRequest)
  assert.throws(() => argv_text(['node', 'a\nb']), BadRequest)
  assert.throws(() => argv_text(['node', '']), BadRequest)
})

it('memory sits above the measured handler floor', () => {
  assert.equal(CAPS.vcpus, 1)
  assert.ok(mib_for({ runtime: 'node' }) > 64)
  assert.equal(mib_for({ runtime: 'node' }, 40), 40)
})
