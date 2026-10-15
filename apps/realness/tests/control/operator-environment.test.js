import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SIGN_ON, URLS } from '../../src/control/status.js'
import { keychain, keychain_for } from '../../src/sign-on/node/login.js'

const DEVELOPMENT = /realness-development|639469569733/

test('production operators sign in and read sync in production only', () => {
  assert.equal(SIGN_ON.production, 'https://realness.online')
  assert.match(URLS.production, /276668807926/)
  assert.doesNotMatch(SIGN_ON.production + URLS.production, DEVELOPMENT)
  assert.match(URLS.development, DEVELOPMENT)
  assert.equal(URLS.local, URLS.development)
})

test('a production sign-in never reads the development keychain entry', () => {
  assert.equal(keychain_for('development'), keychain)
  assert.equal(keychain_for('local'), keychain)
  assert.notEqual(keychain_for('production'), keychain)
})

test('local and development hosts register keys in the development sync bucket', async () => {
  const { environment } = await import('../../tools/control/webspace.config.js')
  for (const name of ['local', 'development']) {
    assert.equal(environment(name).project, 'realness-development')
    assert.equal(
      environment(name).storage,
      'realness-development.firebasestorage.app'
    )
  }
  assert.equal(environment('development').name, 'development')
})

test('production host changes refuse to run without --approved', async () => {
  const { spawnSync } = await import('node:child_process')
  const bin = new URL('../../tools/control/bin/webspace.js', import.meta.url)
    .pathname
  for (const verb of ['up', 'restart', 'down', 'drain', 'revoke']) {
    const run = spawnSync(
      process.execPath,
      [bin, 'production', 'host', verb, 'realness-1'],
      {
        encoding: 'utf8',
        timeout: 20_000
      }
    )
    assert.notEqual(run.status, 0)
    assert.match(
      run.stdout + run.stderr,
      new RegExp(
        `production host ${verb} changes production; rerun with --approved`
      )
    )
  }
})

test('production hosts register keys in the production sync bucket only', async () => {
  const { environment } = await import('../../tools/control/webspace.config.js')
  const config = environment('production')
  assert.equal(config.name, 'production')
  assert.equal(config.project, 'realness-online')
  assert.equal(config.storage, 'realness-online.appspot.com')
  assert.doesNotMatch(
    JSON.stringify(config),
    /realness-development|639469569733/
  )
})
