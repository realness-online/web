import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'

const frontend = file_url_to_path(new URL('../../frontend/', import.meta.url))
const config = file_url_to_path(
  new URL('../../frontend/vite.config.js', import.meta.url)
)

const routing = local => {
  const code = `const { default: config } = await import(${JSON.stringify(config)})
    const gate = config.server.proxy['/gate']
    process.stdout.write(JSON.stringify(gate ? { target: gate.target, ws: gate.ws, http: gate.rewrite('/gate/v1/actors'), socket: gate.rewrite('/gate/pty') } : null))`
  const result = spawn_sync(
    process.execPath,
    ['--input-type=module', '-e', code],
    {
      cwd: frontend,
      encoding: 'utf8',
      env: { ...process.env, BRAYNESS_LOCAL: local ? '1' : '0' }
    }
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('local startup routes HTTP and terminal sockets through the same-origin gate', () => {
  assert.deepEqual(routing(true), {
    target: 'http://127.0.0.1:8792',
    ws: true,
    http: '/v1/actors',
    socket: '/pty'
  })
})

test('normal frontend startup keeps its existing cloud gate configuration', () => {
  assert.equal(routing(false), null)
})
