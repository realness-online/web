import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const main = fileURLToPath(
  new URL('../../server/halo/main.js', import.meta.url)
)

test('serve refuses to start without naming its environment', () => {
  for (const args of [
    [],
    ['--environment', 'local'],
    ['--environment', 'prod']
  ]) {
    const result = spawn_sync(process.execPath, [main, 'serve', ...args], {
      encoding: 'utf8',
      timeout: 20_000
    })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /unknown environment/)
  }
})
