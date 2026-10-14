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
  readFileSync as read_file_sync
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
  deployment_settings,
  environment_settings,
  local_settings
} from '#root/src/settings/environments.js'
import { out_root } from '#root/src/settings/output.js'

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

test('service deploy requires a configured environment and refuses cross-environment data', () => {
  assert.throws(
    () => deployment_settings(undefined, {}),
    /environment is required/
  )
  assert.throws(() => deployment_settings('production', {}), /not configured/)
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

test('Bash and Node use one output rule from a checkout with spaces', t => {
  const artifacts = join(
    project_root,
    '../../artifacts/brayness/settings-tests'
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
  for (const override of [
    '',
    join(scratch, "output with spaces and 'quotes'")
  ]) {
    const env = { ...process.env, BRAYNESS_OUT: override }
    const output = exec_file_sync(
      'bash',
      ['-e', '-c', shell, 'settings-test', root],
      { env, encoding: 'utf8' }
    )
    assert.equal(output, out_root({ root, env }))
  }
})

test('settings CLI rejects missing fields before Bash can use them', () => {
  for (const args of [
    ['shell', 'deploy'],
    ['shell', 'deploy', '--env', 'prod'],
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
