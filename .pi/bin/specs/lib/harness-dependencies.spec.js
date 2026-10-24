import assert from 'node:assert/strict'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { it } from 'node:test'
import { harness_require } from '../../lib/harness-dependencies.js'

const root = resolve(import.meta.dirname, '../../../..')
const manifest = path => JSON.parse(read_file_sync(join(root, path), 'utf8'))

it('harness dependencies resolve inside .pi without a root dependency store', () => {
  assert.equal(exists_sync(join(root, 'node_modules')), false)
  assert.equal(manifest('package.json').dependencies, undefined)
  assert.equal(manifest('package.json').devDependencies, undefined)
  const hidden = manifest('.pi/package.json')
  for (const name of Object.keys({ ...hidden.dependencies, ...hidden.devDependencies })) {
    const path = harness_require.resolve(name)
    assert.ok(path.startsWith(join(root, '.pi/node_modules') + sep), path)
  }
})

it('skills and examples have only their configured .pi locations', () => {
  const config = manifest('package.json')
  assert.deepEqual(config.pi.skills, ['./.pi/skills'])
  assert.equal(config.realness.examples, '.pi/examples')
  for (const name of ['skills', 'examples']) {
    assert.equal(exists_sync(join(root, name)), false)
    assert.ok(exists_sync(join(root, '.pi', name)))
  }
})
