import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { write_resolver } from '../../src/halo/box.js'

it('a box resolves names: its empty template resolver is filled before boot', () => {
  const etc = mkdtempSync(join(tmpdir(), 'box-etc-'))
  writeFileSync(join(etc, 'resolv.conf'), '')
  write_resolver(etc)
  const conf = readFileSync(join(etc, 'resolv.conf'), 'utf8')
  assert.match(conf, /^nameserver 1\.1\.1\.1$/m)
  assert.match(conf, /^nameserver 8\.8\.8\.8$/m)
  assert.match(conf, /single-request-reopen/)
  rmSync(etc, { recursive: true, force: true })
})
