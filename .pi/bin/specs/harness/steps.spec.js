import { it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { harness_specs, steps } from '../../harness/steps.js'
import { pick } from '../../harness/run-steps.js'

const root = resolve(import.meta.dirname, '../../../..')
const read_json = file => JSON.parse(read_file_sync(join(root, file), 'utf8'))
const scripts = read_json('package.json').scripts
const app_scripts = read_json('apps/realness/package.json').scripts

it('npm run check, npm test, and npm run live each run their list', () => {
  assert.equal(scripts.check, 'node .pi/bin/harness/run-steps.js check')
  assert.equal(scripts.test, 'node .pi/bin/harness/run-steps.js test')
  assert.equal(scripts.live, 'node .pi/bin/harness/run-steps.js live')
})

it('the commit hook runs check and then test', () => {
  const hook = read_file_sync(join(root, '.pi/bin/hooks/pre-commit'), 'utf8')
  assert.match(hook, /npm run check && npm test/)
})

it('check covers every checked-in area', () => {
  const areas = new Set(steps.check.map(step => step.area))
  assert.deepEqual([...areas].sort(), ['harness', 'realness'])
})

it('every step points at something that exists', () => {
  for (const step of Object.values(steps).flat()) {
    const app = step.run.match(/^npm --prefix apps\/realness run (\S+)$/)
    if (app) assert.ok(app_scripts[app[1]], `${step.name}: no app script ${app[1]}`)
    const node = step.run.match(/^node (\S+)/)
    if (node) assert.ok(exists_sync(join(root, node[1])), `${step.name}: no file ${node[1]}`)
  }
})

it('step names are unique within an area', () => {
  for (const list of Object.values(steps)) {
    const keys = list.map(step => `${step.area}:${step.name}`)
    assert.equal(new Set(keys).size, keys.length)
  }
})

it('a step can run alone by name, and an unknown name fails', () => {
  assert.deepEqual(
    pick('live', ['halo']).map(step => step.name),
    ['halo']
  )
  assert.throws(() => pick('live', ['nope']), /unknown live step: nope/)
  assert.throws(() => pick('nope', []), /unknown kind/)
})

it('Fallow treats every harness spec glob as an entry', () => {
  const entry = read_json('.fallowrc.json').entry
  for (const glob of harness_specs) assert.ok(entry.includes(glob), `${glob} missing from .fallowrc.json entry`)
})
