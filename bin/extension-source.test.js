import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')
const names = ['agents-local', 'artifacts-prune', 'edit-log', 'memory', 'prewalk', 'project-tooling']

test('installed Pi loads the JavaScript extensions and their registrations', async context => {
  const parent = join(root, 'artifacts/realness/extension-load')
  mkdir_sync(parent, { recursive: true })
  const fixture = mkdtemp_sync(join(parent, 'agent-'))
  const keys = ['PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'BRAYNESS_STATE']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  context.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
    rm_sync(fixture, { recursive: true, force: true })
  })
  process.env.PI_CODING_AGENT_DIR = join(fixture, '.pi/agent')
  process.env.PI_CODING_AGENT_SESSION_DIR = join(fixture, 'sessions')
  process.env.BRAYNESS_STATE = join(fixture, 'state')
  const { loadExtensions: load_extensions } = await import('../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js')
  const loaded = await load_extensions(names.map(name => join(root, '.pi/extensions', name, 'index.js')), fixture)
  assert.deepEqual(loaded.errors, [])
  assert.equal(loaded.extensions.length, names.length)
  const tools = loaded.extensions.flatMap(extension => [...extension.tools.keys()])
  const commands = loaded.extensions.flatMap(extension => [...extension.commands.keys()])
  assert.ok(tools.includes('remember'))
  assert.ok(tools.includes('project_tooling'))
  for (const name of ['remember', 'ptooling', 'prewalk', 'insert']) assert.ok(commands.includes(name), name)
  for (const extension of loaded.extensions) assert.ok(extension.handlers.size || extension.tools.size)
})
