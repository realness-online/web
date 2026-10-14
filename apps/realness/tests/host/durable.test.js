import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { writeFileDurable } from '../../src/host/durable.js'

test('durable write replaces the file and leaves no temp', () => {
  const dir = mkdtempSync(join(tmpdir(), 'durable-'))
  const file = join(dir, 'loops.json')
  writeFileDurable(file, '{}\n')
  writeFileDurable(file, '{"a":1}\n')
  assert.equal(readFileSync(file, 'utf8'), '{"a":1}\n')
  assert.deepEqual(readdirSync(dir), ['loops.json'])
})
