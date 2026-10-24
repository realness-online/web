import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { it } from 'node:test'

const main = file_url_to_path(
  new URL('../../server/halo/main.js', import.meta.url)
)

const run = (...args) =>
  spawn_sync(process.execPath, [main, ...args], { encoding: 'utf8' })

it('the halo accepts an explicit site URL before requiring a command', () => {
  const result = run('--site-url', 'https://sites.test/{id}/')
  assert.equal(result.status, 2, result.stderr)
  assert.match(result.stderr, /usage: main.js serve\|seed/)
  assert.equal(result.stdout, '')
})

it('the site URL option requires a value', () => {
  const result = run('--site-url')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ERR_PARSE_ARGS_INVALID_OPTION_VALUE/)
})
