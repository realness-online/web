import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')
const ROLES = ['standard', 'house']

const ids_in = (path, pattern) =>
  [...readFileSync(join(ROOT, path), 'utf8').matchAll(pattern)].map(
    match => match[1]
  )

test('shipped model ids are role names, so a model change is a proxy setting', () => {
  const ids = [
    ...ids_in(
      'tools/control/scripts/ship-stage.js',
      /\bid: '([^']+)',\s*name:/g
    ),
    ...ids_in(
      'src/app/utils/explorer-provider.js',
      /\bid: '([^']+)',\s*name: '[^']*',\s*provider:/g
    ),
    ...ids_in('src/app/utils/explorer.js', /\bmodelId: '([^']+)'/g),
    ...ids_in('../../.pi/starter/settings.json', /"defaultModel": "([^"]+)"/g)
  ]
  assert.ok(ids.length >= 4)
  assert.deepEqual(
    ids.filter(id => !ROLES.includes(id)),
    []
  )
})
