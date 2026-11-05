import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')

/** @param {string} dir @returns {string[]} */
const sources = dir =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter(path => path.endsWith('.js') && !path.includes('node_modules'))
    .map(path => join(dir, path))

test('secrets are read from the secrets folder, never from artifacts', () => {
  const found = ['src', 'server', 'tools', 'lib']
    .flatMap(sources)
    .filter(path =>
      /out_path\(\s*['"][^'"]*secret/.test(
        readFileSync(join(ROOT, path), 'utf8')
      )
    )
  assert.deepEqual(found, [])
})
