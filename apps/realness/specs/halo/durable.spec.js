import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import { write_file_durable } from '../../src/halo/durable.js'

it('durable write replaces the file and leaves no temp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'durable-'))
  const file = join(dir, 'loops.json')
  write_file_durable(file, '{}\n')
  write_file_durable(file, '{"a":1}\n')
  assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n')
  assert.deepEqual(readdirSync(dir), ['loops.json'])
})
