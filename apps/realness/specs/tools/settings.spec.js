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
import { it } from 'node:test'
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

it('layout owns absolute product paths and runtime source sets', () => {
  const paths = product_paths('/a checkout with spaces/product')
  assert.equal(paths.frontend, '/a checkout with spaces/product')
  assert.equal(paths.themes, '/a checkout with spaces/product/themes')
  assert.equal(paths.app, '/a checkout with spaces/product/src/app')
  for (const name of ['chat', 'terminal']) assert.equal(paths[name], undefined)
  assert.ok(actor_folders().includes('src/settings'))
  assert.ok(!actor_folders().some(folder => folder.includes('server/sync')))
  assert.ok(service_folders('gate').includes('src/proxy'))
  assert.throws(() => service_folders('other'), /unknown service/)
})

it('frontend targets retain Firebase aliases; local services name no cloud project', () => {
  const firebase = JSON.parse(
    read_file_sync(join(project_root, '.firebaserc'), 'utf8')
  )
  for (const name of ['development', 'production'])
    assert.equal(environment_settings(name).project, firebase.projects[name])
  assert.equal(local_settings.cloud, environment_settings('local'))
  assert.match(local_settings.cloud.project, /^demo-/)
  assert.throws(() => environment_settings('prod'), /unknown environment/)
  assert.throws(() => environment_settings('toString'), /unknown environment/)
  assert.notEqual(
    environment_settings('development').project,
    environment_settings('production').project
  )
})

it('each browser mode reaches its own gate and local stays local', () => {
  const development = environment_settings('development').services
  for (const mode of ['development', 'test'])
    assert.deepEqual(browser_settings(mode), {
      gate_url: development.gate_url,
      proxy_url: development.proxy_url
    })
  assert.deepEqual(browser_settings('production'), {
    gate_url: environment_settings('production').services.gate_url,
    proxy_url: environment_settings('production').services.proxy_url,
    sync_url: '/v1'
  })
  assert.deepEqual(browser_settings('dev-local'), {
    gate_url: '/gate',
    proxy_url: '/model',
    sign_in_url: '/sign-in',
    sync_url: '/sync'
  })
  for (const mode of ['dev', 'local', 'toString', undefined])
    assert.throws(() => browser_settings(mode), /unknown browser mode/)
})

it('service deploy requires a configured environment and refuses cross-environment data', () => {
  assert.throws(
    () => deployment_settings(undefined, {}),
    /environment is required/
  )
  assert.deepEqual(deployment_settings('production', {}), {
    project: 'realness-online',
    identity: 'realness-online',
    bucket: 'realness-online.appspot.com',
    region: 'us-west2',
    origins:
      'https://realness.online,https://realness-online.web.app,https://realness-online.firebaseapp.com',
    sync_url: 'https://realness-sync-276668807926.us-west2.run.app'
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

it('actor detection follows the guest marker and the installed runtime', t => {
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

it('Bash and Node use one output rule from a checkout with spaces', t => {
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

it('settings output ignores the removed legacy override', () => {
  const output = exec_file_sync(process.execPath, [cli, 'output'], {
    env: {
      ...process.env,
      REALNESS_OUT: join(project_root, 'ignored output')
    },
    encoding: 'utf8'
  })
  assert.equal(output.trim(), out_root())
})

it('settings CLI rejects missing fields before Bash can use them', () => {
  for (const args of [
    ['shell', 'deploy'],
    ['shell', 'deploy', '--env', 'prod'],
    ['shell', 'halo'],
    ['shell', 'halo', '--env', ''],
    ['shell', 'halo', '--env', 'local'],
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

it('a cloud halo reads only the services of its own environment', () => {
  const read = env =>
    Object.fromEntries(
      exec_file_sync(process.execPath, [cli, 'shell', 'halo', '--env', env], {
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

it('local sync keeps files in the configured iCloud store when it exists', async () => {
  const { mkdtemp, mkdir, rm } = await import('node:fs/promises')
  const { icloud_sync, out_path, sync_dir } =
    await import('../../src/settings/output.js')
  const home = await mkdtemp(out_path('sync-dir-home-'))
  try {
    assert.equal(sync_dir({ HOME: home }), out_path('sync-data'))
    await mkdir(icloud_sync(home), { recursive: true })
    assert.match(icloud_sync(home), /Realness-sync-2$/)
    assert.equal(sync_dir({ HOME: home }), icloud_sync(home))
    assert.equal(sync_dir({ HOME: home, SYNC_DIR: '/x/y' }), '/x/y')
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
