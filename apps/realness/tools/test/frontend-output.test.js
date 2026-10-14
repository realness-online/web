import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const parent = resolve(root, '../../artifacts/realness/frontend-output')

const fixture = context => {
  mkdir_sync(parent, { recursive: true })
  const directory = mkdtemp_sync(join(parent, 'test-'))
  context.after(() => rm_sync(directory, { recursive: true, force: true }))
  const env = { ...process.env, BRAYNESS_OUT: join(directory, 'output with spaces'), DIST_DIR: join(directory, 'site with spaces') }
  const run = (...args) => exec_file_sync(process.execPath, args, { cwd: join(root, 'frontend'), env, encoding: 'utf8' })
  return { env, run }
}

test('Vite, prerender, and settings select the same external frontend directory', context => {
  const { env, run } = fixture(context)
  const source = `import browser from './vite.config.js'; import server from './vite.prerender.config.js'; console.log(JSON.stringify({ browser: browser.build.outDir, server: server.build.outDir, bundled: server.ssr.noExternal }))`
  const config = JSON.parse(run('--input-type=module', '-e', source))
  assert.equal(config.browser, env.DIST_DIR)
  assert.equal(config.server, join(env.DIST_DIR, 'server'))
  assert.equal(config.bundled, true)
  assert.equal(run('../src/settings/cli.js', 'output', 'frontend').trim(), env.DIST_DIR)
})

test('hosting configuration retains targets, rules and secondary hosting paths', context => {
  const { env, run } = fixture(context)
  run('scripts/build-hosting-config.js')
  const generated = JSON.parse(read_file_sync(join(env.BRAYNESS_OUT, 'frontend/firebase.json'), 'utf8'))
  const template = JSON.parse(read_file_sync(join(root, 'frontend/firebase.json'), 'utf8'))
  const expected = structuredClone(template)
  expected.hosting.find(hosting => hosting.target === 'app').public = env.DIST_DIR
  expected.hosting.find(hosting => hosting.target === 'sites').public = join(root, 'frontend/sites')
  expected.storage.rules = join(root, 'frontend/storage.rules')
  assert.deepEqual(generated, expected)
  assert.equal(read_file_sync(join(env.BRAYNESS_OUT, 'frontend/.firebaserc'), 'utf8'), read_file_sync(join(root, 'frontend/.firebaserc'), 'utf8'))
})

test('manifest generation reads the selected output rather than the old dist folder', context => {
  const { env, run } = fixture(context)
  mkdir_sync(env.DIST_DIR, { recursive: true })
  write_file_sync(join(env.DIST_DIR, 'index.html'), '<!doctype html><title>Output fixture</title>')
  run('scripts/build-manifest.js')
  const manifest = JSON.parse(read_file_sync(join(env.DIST_DIR, 'build-manifest.json'), 'utf8'))
  assert.deepEqual(Object.keys(manifest.files), ['/index.html'])
  assert.match(manifest.files['/index.html'], /^sha256:/)
})
