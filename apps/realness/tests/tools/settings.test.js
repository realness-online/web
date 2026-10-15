import assert from 'node:assert/strict'
import {
  execFileSync as exec_file_sync,
  spawnSync as spawn_sync
} from 'node:child_process'
import {
  cpSync as cp_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  readFileSync as read_file_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  actor_folders,
  project_root,
  product_paths,
  service_folders
} from '#root/src/settings/layout.js'
import {
  browser_settings,
  deployment_settings,
  environment_settings,
  local_settings
} from '#root/src/settings/environments.js'
import { out_root } from '#root/src/settings/output.js'
import { is_actor } from '#root/src/harness/settings.js'

const cli = join(project_root, 'src/settings/cli.js')

test('layout owns absolute product paths and runtime source sets', () => {
  const paths = product_paths('/a checkout with spaces/product')
  assert.equal(paths.frontend, '/a checkout with spaces/product/frontend')
  assert.equal(paths.themes, '/a checkout with spaces/product/themes')
  assert.equal(paths.app, '/a checkout with spaces/product/src/app')
  for (const name of ['chat', 'terminal']) assert.equal(paths[name], undefined)
  assert.ok(actor_folders().includes('src/settings'))
  assert.ok(!actor_folders().some(folder => folder.includes('server/sync')))
  assert.ok(service_folders('gate').includes('src/proxy'))
  assert.throws(() => service_folders('other'), /unknown service/)
})

test('frontend targets retain Firebase aliases; local services keep development cloud reads', () => {
  const firebase = JSON.parse(
    read_file_sync(join(project_root, 'frontend/.firebaserc'), 'utf8')
  )
  for (const name of ['development', 'production'])
    assert.equal(environment_settings(name).project, firebase.projects[name])
  assert.equal(local_settings.cloud, environment_settings('development'))
  assert.throws(() => environment_settings('prod'), /unknown environment/)
  assert.throws(() => environment_settings('toString'), /unknown environment/)
  assert.notEqual(
    environment_settings('development').project,
    environment_settings('production').project
  )
})

test('browser modes preserve the cloud gate and isolate local routing', () => {
  const gate_url = environment_settings('development').services.gate_url
  for (const mode of ['development', 'production', 'test'])
    assert.deepEqual(browser_settings(mode), { gate_url })
  assert.deepEqual(browser_settings('local'), { gate_url: '/gate' })
  for (const mode of ['dev', 'toString', undefined])
    assert.throws(() => browser_settings(mode), /unknown browser mode/)
})

test('service deploy requires a configured environment and refuses cross-environment data', () => {
  assert.throws(
    () => deployment_settings(undefined, {}),
    /environment is required/
  )
  assert.deepEqual(deployment_settings('production', {}), {
    project: 'realness-online',
    identity: 'realness-online',
    bucket: 'realness-online.appspot.com',
    region: 'us-central1',
    origins:
      'https://realness.online,https://realness-online.web.app,https://realness-online.firebaseapp.com'
  })
  assert.throws(
    () =>
      deployment_settings('production', {
        BUCKET: 'realness-development.firebasestorage.app'
      }),
    /conflicts with production/
  )
  for (const env of [
    { PROJECT: 'realness-online' },
    { IDENTITY_PROJECT: 'realness-online' },
    { BUCKET: 'realness-online.firebasestorage.app' }
  ]) {
    assert.throws(
      () => deployment_settings('development', env),
      /conflicts with development/
    )
  }
  assert.equal(
    deployment_settings('development', {}).project,
    'realness-development'
  )
})

test('actor detection follows the guest marker and the installed runtime', t => {
  const parent = join(project_root, '../../artifacts/realness/actor-detection')
  mkdir_sync(parent, { recursive: true })
  const root = mkdtemp_sync(join(parent, 'guest-'))
  t.after(() => rm_sync(root, { recursive: true, force: true }))
  assert.equal(is_actor(root), false)
  mkdir_sync(join(root, 'etc/realness'), { recursive: true })
  write_file_sync(join(root, 'etc/realness/actor'), 'actor-id\n')
  assert.equal(is_actor(root), true)
  rm_sync(join(root, 'etc'), { recursive: true })
  mkdir_sync(join(root, 'usr/local/lib/realness'), { recursive: true })
  write_file_sync(join(root, 'usr/local/lib/realness/package.json'), '{}')
  assert.equal(is_actor(root), true)
})

test('Bash and Node use one output rule from a checkout with spaces', t => {
  const artifacts = join(
    project_root,
    '../../artifacts/realness/settings-tests'
  )
  mkdir_sync(artifacts, { recursive: true })
  const scratch = mkdtemp_sync(join(artifacts, 'settings-'))
  t.after(() => rm_sync(scratch, { recursive: true, force: true }))
  const root = join(scratch, 'harness', 'apps', 'product with spaces')
  mkdir_sync(join(root, 'lib'), { recursive: true })
  mkdir_sync(join(root, '../../artifacts'), { recursive: true })
  cp_sync(join(project_root, 'src/settings'), join(root, 'src/settings'), {
    recursive: true
  })
  cp_sync(join(project_root, 'lib/output.sh'), join(root, 'lib/output.sh'))
  cp_sync(join(project_root, 'package.json'), join(root, 'package.json'))
  const shell = 'source "$1/lib/output.sh"; printf "%s" "$OUT"'
  const output = exec_file_sync(
    'bash',
    ['-e', '-c', shell, 'settings-test', root],
    { encoding: 'utf8' }
  )
  assert.equal(output, out_root({ root }))
})

test('settings output ignores the removed legacy override', () => {
  const output = exec_file_sync(process.execPath, [cli, 'output'], {
    env: {
      ...process.env,
      REALNESS_OUT: join(project_root, 'ignored output')
    },
    encoding: 'utf8'
  })
  assert.equal(output.trim(), out_root())
})

test('settings CLI rejects missing fields before Bash can use them', () => {
  for (const args of [
    ['shell', 'deploy'],
    ['shell', 'deploy', '--env', 'prod'],
    ['shell', 'host'],
    ['shell', 'host', '--env', ''],
    ['shell', 'host', '--env', 'local'],
    ['folders', 'service'],
    ['folders', 'other']
  ]) {
    const result = spawn_sync(process.execPath, [cli, ...args], {
      encoding: 'utf8'
    })
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
  }
  const env = {
    ...process.env,
    ORIGINS: "https://example.test/'quoted'; false"
  }
  const settings = exec_file_sync(
    process.execPath,
    [cli, 'shell', 'deploy', '--env', 'development'],
    { env, encoding: 'utf8' }
  )
  const actual = exec_file_sync(
    'bash',
    [
      '-e',
      '-c',
      'eval "$1"; printf "%s" "$origins"',
      'settings-test',
      settings
    ],
    { encoding: 'utf8' }
  )
  assert.equal(actual, env.ORIGINS)
})

test('a cloud host reads only the services of its own environment', () => {
  const read = env =>
    Object.fromEntries(
      exec_file_sync(process.execPath, [cli, 'shell', 'host', '--env', env], {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .map(line => line.split('=').map(part => part.replaceAll("'", '')))
    )
  const production = read('production')
  assert.equal(
    production.sync_url_default,
    environment_settings('production').services.sync_url
  )
  assert.equal(production.sites_url_default, '')
  assert.doesNotMatch(
    JSON.stringify(production),
    /realness-development|639469569733/
  )
  assert.equal(
    read('development').sync_url_default,
    environment_settings('development').services.sync_url
  )
})
