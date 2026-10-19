import assert from 'node:assert/strict'
import test from 'node:test'
import {
  choose,
  next_version,
  release_plan,
  touches
} from '../../tools/control/scripts/ship.js'

test('the release line steps one letter', () => {
  assert.equal(next_version('3.0.0-i'), '3.0.0-j')
  assert.equal(next_version('3.0.0-a'), '3.0.0-b')
  assert.equal(next_version('3.0.0'), '3.0.0-a')
})

test('a finished line and a broken version are refused', () => {
  assert.throws(() => next_version('3.0.0-z'), /end of its line/)
  assert.throws(() => next_version('three'), /cannot read version/)
})

test('a path inside a folder is a touch; a sibling is not', () => {
  assert.equal(touches(['src/proxy/rows.js'], ['src/proxy']), true)
  assert.equal(touches(['src/proxy'], ['src/proxy']), true)
  assert.equal(touches(['src/proxyx/rows.js'], ['src/proxy']), false)
  assert.equal(touches(['src/gate/wake.js'], ['src/proxy']), false)
})

test('proxy source reaches the proxy, the gate, and the halo', () => {
  assert.deepEqual(choose(['src/proxy/rows.js']), [
    'frontend',
    'proxy',
    'gate',
    'halo'
  ])
})

test('shared source reaches every service that includes it', () => {
  assert.deepEqual(choose(['src/can/pass.js']), [
    'frontend',
    'proxy',
    'gate',
    'sync',
    'halo'
  ])
})

test('halo source needs the halo and nothing else', () => {
  assert.deepEqual(choose(['src/halo/server.js']), ['frontend', 'halo'])
  assert.deepEqual(choose(['server/halo/guest/realness-agent.py']), [
    'frontend',
    'halo'
  ])
})

test('a functions change deploys functions', () => {
  assert.deepEqual(choose(['functions/src/index.js']), [
    'frontend',
    'functions'
  ])
})

test('a frontend-only change deploys the frontend', () => {
  assert.deepEqual(choose(['frontend/CHANGELOG.md']), ['frontend'])
})

test('a release with no changes still deploys the frontend', () => {
  assert.deepEqual(choose(['']), ['frontend'])
})

test('the release uploads the build the deploy shipped', () => {
  assert.deepEqual(release_plan(['frontend']), [
    'version',
    'deploy:frontend',
    'release',
    'verify'
  ])
  assert.deepEqual(release_plan(['frontend', 'proxy']), [
    'version',
    'deploy:frontend',
    'deploy:proxy',
    'release',
    'verify'
  ])
  assert.equal(
    release_plan(['frontend']).includes('build'),
    false,
    'no build before the deploy: it would not be the deployed build'
  )
})
