import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/src/settings/output.js'

const SCRIPT = join(
  import.meta.dirname,
  '../../server/halo/guest/realness-models.js'
)

const json = path => JSON.parse(read_file_sync(path, 'utf8'))
const put = (dir, name, value) =>
  write_file_sync(join(dir, name), JSON.stringify(value))

const agents = () => {
  mkdir_sync(out_path('realness-models-tests'), { recursive: true })
  const root = mkdtemp_sync(join(out_path('realness-models-tests'), 'run-'))
  const starter = join(root, 'starter')
  const home = join(root, 'home')
  mkdir_sync(starter)
  mkdir_sync(home)
  put(starter, 'models.json', {
    providers: { realness: { baseUrl: 'new', models: [{ id: 'standard' }] } }
  })
  put(starter, 'settings.json', { defaultModel: 'standard' })
  return { starter, home }
}

const run = ({ starter, home }) =>
  exec_file_sync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      REALNESS_STARTER_AGENT: starter,
      REALNESS_AGENT: home
    }
  })

test("replaces the realness provider and keeps the person's own", () => {
  const dirs = agents()
  put(dirs.home, 'models.json', {
    providers: {
      realness: { baseUrl: 'old', models: [{ id: 'inkling' }] },
      openrouter: { apiKey: 'mine' }
    }
  })
  put(dirs.home, 'settings.json', {
    defaultProvider: 'realness',
    defaultModel: 'inkling',
    enabledModels: ['realness/inkling', 'openrouter/kimi', 'realness/standard']
  })
  run(dirs)
  assert.deepEqual(json(join(dirs.home, 'models.json')).providers, {
    realness: { baseUrl: 'new', models: [{ id: 'standard' }] },
    openrouter: { apiKey: 'mine' }
  })
  assert.deepEqual(json(join(dirs.home, 'settings.json')), {
    defaultProvider: 'realness',
    defaultModel: 'standard',
    enabledModels: ['openrouter/kimi', 'realness/standard']
  })
})

test('a harness with no models file gets the realness provider', () => {
  const dirs = agents()
  run(dirs)
  assert.deepEqual(json(join(dirs.home, 'models.json')), {
    providers: { realness: { baseUrl: 'new', models: [{ id: 'standard' }] } }
  })
})

test('a person who chose another provider keeps their default', () => {
  const dirs = agents()
  const settings = { defaultProvider: 'openrouter', defaultModel: 'kimi' }
  put(dirs.home, 'settings.json', settings)
  run(dirs)
  assert.deepEqual(json(join(dirs.home, 'settings.json')), settings)
})
