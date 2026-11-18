import { it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../..', import.meta.url).pathname

const read = path => read_file_sync(join(root, path), 'utf8')

it('o7: the plans app and its commands are gone; npm run vault builds the blog', () => {
  for (const gone of [
    'apps/plans',
    '.pi/bin/plans/plans.js',
    '.pi/bin/plans/plans-serve.js',
    '.pi/bin/specs/plans/vault-serve.spec.js',
    '.pi/bin/specs/plans/vault-parity.spec.js',
    '.pi/bin/specs/plans/plans-changed.spec.js'
  ])
    assert.equal(exists_sync(join(root, gone)), false, gone)
  const scripts = JSON.parse(read('package.json')).scripts
  assert.equal(scripts.vault, 'node ./.pi/bin/vault/build.js')
  for (const gone of ['plans', 'vault:serve', 'plans:serve']) assert.equal(scripts[gone], undefined, gone)
  assert.match(read('.pi/bin/vault/build.js'), /build_app\(root, 'blog'/)
})
