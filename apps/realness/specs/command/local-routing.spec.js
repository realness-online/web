import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'

const frontend = file_url_to_path(new URL('../../', import.meta.url))
const config = file_url_to_path(
  new URL('../../vite.config.js', import.meta.url)
)

const routing = mode => {
  const code = `const { default: configure } = await import(${JSON.stringify(config)})
    const config = configure({ mode: ${JSON.stringify(mode)} })
    const gate = config.server.proxy['/gate']
    const model = config.server.proxy['/model']
    process.stdout.write(JSON.stringify({ mode: config.server.headers['X-Vite-Mode'], gate: gate ? { target: gate.target, ws: gate.ws, http: gate.rewrite('/gate/v1/actors'), socket: gate.rewrite('/gate/pty') } : null, model: model ? { target: model.target, http: model.rewrite('/model/v1/chat/completions') } : null }))`
  const result = spawn_sync(
    process.execPath,
    ['--input-type=module', '-e', code],
    { cwd: frontend, encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

it('local mode routes HTTP and terminal sockets through the same-origin gate', () => {
  assert.deepEqual(routing('dev-local'), {
    mode: 'dev-local',
    gate: {
      target: 'http://127.0.0.1:8792',
      ws: true,
      http: '/v1/actors',
      socket: '/pty'
    },
    model: {
      target: 'http://127.0.0.1:8788',
      http: '/v1/chat/completions'
    }
  })
})

for (const mode of ['development', 'production'])
  it(`${mode} frontend startup keeps its existing cloud gate configuration`, () => {
    assert.deepEqual(routing(mode), { mode, gate: null, model: null })
  })
