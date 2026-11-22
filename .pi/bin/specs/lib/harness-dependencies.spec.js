import assert from 'node:assert/strict'
import { existsSync as exists_sync, readFileSync as read_file_sync, readlinkSync as read_link_sync } from 'node:fs'
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
  const declared = { ...hidden.dependencies, ...hidden.devDependencies }
  for (const [name, range] of Object.entries(declared)) {
    if (range.startsWith('file:')) continue
    const { main, exports, bin } = harness_require(`${name}/package.json`)
    const command_only = bin && !main && !exports
    const path = harness_require.resolve(command_only ? `${name}/package.json` : name)
    assert.ok(path.startsWith(join(root, '.pi/node_modules') + sep), path)
  }
})

it('the harness links the app itself, and takes nothing else by path', () => {
  const hidden = manifest('.pi/package.json')
  const linked = Object.keys(hidden.dependencies).filter(name => hidden.dependencies[name].startsWith('file:'))
  assert.deepEqual(linked, ['realness'])
  assert.equal(read_link_sync(join(root, '.pi/node_modules/realness')), '../../apps/realness')
  assert.equal(exists_sync(join(root, '.pi/runtime/node_modules/realness')), false)
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
