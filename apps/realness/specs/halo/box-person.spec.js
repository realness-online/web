import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { write_owner_person } from '../../src/halo/box.js'
import { person } from '../../src/harness/settings.js'

it("a box's harness names its owner, so a scout run knows whose leads it writes", () => {
  const realness = mkdtempSync(join(tmpdir(), 'box-realness-'))
  write_owner_person(realness, '+14155550123')
  assert.equal(person(realness), '/+14155550123')
  rmSync(realness, { recursive: true, force: true })
})

it('a person file the owner wrote is kept', () => {
  const realness = mkdtempSync(join(tmpdir(), 'box-realness-'))
  mkdirSync(join(realness, '.pi'))
  writeFileSync(
    join(realness, '.pi/person.local.html'),
    '<a itemprop="telephone" href="tel:+14155559999">Scott</a>\n'
  )
  write_owner_person(realness, '+14155550123')
  assert.equal(person(realness), '/+14155559999')
  rmSync(realness, { recursive: true, force: true })
})
