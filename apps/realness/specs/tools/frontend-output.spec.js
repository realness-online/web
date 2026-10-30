import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { it } from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const parent = resolve(root, '../../artifacts/realness/frontend-output')

const fixture = context => {
  mkdir_sync(parent, { recursive: true })
  const directory = mkdtemp_sync(join(parent, 'test-'))
  context.after(() => rm_sync(directory, { recursive: true, force: true }))
  const output_root = join(directory, "output with spaces and 'quotes'")
  const env = {
    ...process.env,
    DIST_DIR: join(directory, 'site with spaces')
  }
  const run = (...args) =>
    exec_file_sync(process.execPath, args, {
      cwd: root,
      env,
      encoding: 'utf8'
    })
  return { env, output_root, run }
}

it('Vite, prerender, and settings select the same external frontend directory', context => {
  const { env, run } = fixture(context)
  const source = `import browser from './vite.config.js'; import server from './vite.prerender.config.js'; console.log(JSON.stringify({ browser: browser({ mode: 'development' }).build.outDir, server: server.build.outDir, bundled: server.ssr.noExternal }))`
  const config = JSON.parse(run('--input-type=module', '-e', source))
  assert.equal(config.browser, env.DIST_DIR)
  assert.equal(config.server, join(env.DIST_DIR, 'server'))
  assert.equal(config.bundled, true)
  assert.equal(
    run('src/settings/cli.js', 'output', 'frontend').trim(),
    env.DIST_DIR
  )
})

it('the dev server resolves the separate Durable bundle before transforming Explorer', context => {
  const { env, run } = fixture(context)
  mkdir_sync(env.DIST_DIR, { recursive: true })
  write_file_sync(
    join(env.DIST_DIR, 'pi-durable.browser.js'),
    'export const ready = true'
  )
  const source = `
    import { createServer as create_server } from 'vite-plus'
    const server = await create_server({
      mode: 'development', logLevel: 'silent',
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] }
    })
    try {
      const resolved = await server.pluginContainer.resolveId('/pi-durable.browser.js')
      const transformed = await server.transformRequest('/src/app/utils/explorer.js')
      process.stdout.write(JSON.stringify({ id: resolved?.id, code: transformed?.code }))
    } finally { await server.close() }
  `
  const result = JSON.parse(run('--input-type=module', '-e', source))
  assert.equal(result.id, join(env.DIST_DIR, 'pi-durable.browser.js'))
  assert.match(result.code, /pi-durable\.browser\.js/)
})

it('hosting configuration retains targets, rules and secondary hosting paths', context => {
  const { env, output_root, run } = fixture(context)
  run('scripts/build-hosting-config.js', output_root)
  const generated = JSON.parse(
    read_file_sync(join(output_root, 'frontend/firebase.json'), 'utf8')
  )
  const template = JSON.parse(
    read_file_sync(join(root, 'firebase.json'), 'utf8')
  )
  const expected = structuredClone(template)
  expected.hosting.find(hosting => hosting.target === 'app').public =
    env.DIST_DIR
  expected.hosting.find(hosting => hosting.target === 'sites').public = join(
    root,
    'sites'
  )
  expected.storage.rules = join(root, 'storage.rules')
  assert.deepEqual(generated, expected)
  assert.equal(
    read_file_sync(join(output_root, 'frontend/.firebaserc'), 'utf8'),
    read_file_sync(join(root, '.firebaserc'), 'utf8')
  )
})

it('production hosting routes only to sync, in its region (m2)', context => {
  const { output_root, run } = fixture(context)
  run('scripts/build-hosting-config.js', output_root, '--env', 'production')
  const generated = JSON.parse(
    read_file_sync(join(output_root, 'frontend/firebase.json'), 'utf8')
  )
  const routes = generated.hosting.flatMap(hosting => hosting.rewrites ?? [])
  assert.ok(routes.length > 0, 'page rewrites remain')
  assert.deepEqual(
    routes.filter(rewrite => rewrite.run),
    [
      {
        source: '/v1/**',
        run: { serviceId: 'realness-sync', region: 'us-west2' }
      },
      {
        source: '/sites/**',
        run: { serviceId: 'realness-sync', region: 'us-west2' }
      }
    ]
  )
})

it('manifest generation reads the selected output rather than the old dist folder', context => {
  const { env, run } = fixture(context)
  mkdir_sync(env.DIST_DIR, { recursive: true })
  write_file_sync(
    join(env.DIST_DIR, 'index.html'),
    '<!doctype html><title>Output fixture</title>'
  )
  run('scripts/build-manifest.js')
  const manifest = JSON.parse(
    read_file_sync(join(env.DIST_DIR, 'build-manifest.json'), 'utf8')
  )
  assert.deepEqual(Object.keys(manifest.files), ['/index.html'])
  assert.match(manifest.files['/index.html'], /^sha256:/)
})
