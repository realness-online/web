import { test } from 'node:test'
import { readFileSync as read_file_sync } from 'node:fs'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { frontend_out, out_path } from '#root/src/settings/output.js'

const entry = file_url_to_path(
  new URL('../../tools/cli/bin/realness.js', import.meta.url)
)
const project = file_url_to_path(new URL('../../', import.meta.url))
const { version } = JSON.parse(
  read_file_sync(new URL('../../package.json', import.meta.url), 'utf8')
)
const invoke = args =>
  spawn_sync(process.execPath, [entry, 'frontend', ...args], {
    encoding: 'utf8',
    env: { ...process.env, REALNESS_ACTOR: '0', PROFILE: 'desktop' }
  })
const plan = args => {
  const result = invoke([...args, '--dry-run'])
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}

test('frontend builds default to development without deploying', () => {
  const result = plan(['build'])
  assert.equal(result.environment, 'development')
  assert.equal(result.steps.length, 6)
  assert.equal(
    result.steps.filter(step => step.args.includes('--mode')).length,
    2
  )
  assert.ok(result.steps.every(step => !step.args.includes('deploy')))
})

test('production keeps wasm, CSS checks, prerender and manifest', () => {
  const result = plan(['build', '--env', 'production'])
  assert.deepEqual(
    result.steps.map(step => step.args),
    [
      ['run', 'build:icons'],
      ['run', 'build:wasm'],
      ['scripts/generate-toc.js'],
      ['exec', '--', 'vp', 'build'],
      ['scripts/check-interaction-css.js'],
      ['exec', '--', 'vp', 'build', '-c', 'vite.prerender.config.js'],
      ['scripts/prerender.js'],
      ['scripts/build-manifest.js']
    ]
  )
  assert.ok(result.steps.every(step => step.cwd.startsWith(project)))
})

test('deploy requires a valid explicit environment before any execution', () => {
  for (const args of [
    ['deploy'],
    ['deploy', '--dry-run'],
    ['build', '--env'],
    ['deploy', '--env', 'prod'],
    ['build', '--unexpected'],
    ['deploy', '--env', 'development', '--env', 'production']
  ]) {
    const result = invoke(args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /usage:/)
    assert.equal(result.stdout, '')
  }
})

test('development deploy preserves hosting-only target', () => {
  const { steps } = plan(['deploy', '--env', 'development'])
  assert.deepEqual(steps.at(-1).args.slice(3), [
    'deploy',
    '--only',
    'hosting',
    '--project',
    'realness-development',
    '-m',
    version,
    '--config',
    out_path('frontend', 'firebase.json')
  ])
  assert.ok(
    !steps.some(
      step =>
        step.args.includes('build:wasm') || step.args.includes('build:workers')
    )
  )
})

test('production deploy explicitly selects production, builds once, then verifies', () => {
  const { steps } = plan(['deploy', '--env', 'production'])
  assert.deepEqual(steps[0].args, ['run', 'build:workers'])
  assert.equal(steps.filter(step => step.args.includes('build:wasm')).length, 1)
  assert.deepEqual(steps.at(-2).args.slice(3), [
    'deploy',
    '--only',
    'hosting:app,storage',
    '--project',
    'realness-online',
    '-m',
    version,
    '--config',
    out_path('frontend', 'firebase.json')
  ])
  assert.deepEqual(steps.at(-1).args, [
    'scripts/verify-deploy.js',
    '--manifest',
    frontend_out('build-manifest.json'),
    '--url',
    'https://realness.online'
  ])
})
