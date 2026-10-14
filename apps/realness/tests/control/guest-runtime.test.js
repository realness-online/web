import assert from 'node:assert/strict'
import {
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync
} from 'node:fs'
import { createRequire as create_require } from 'node:module'
import { join, relative } from 'node:path'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { test } from 'node:test'
import { ROOT } from '../../src/control/paths.js'
import { actor_folders } from '#root/src/settings/layout.js'

const RUNTIME = '/usr/local/lib/brayness/'
const read = path => read_file_sync(`${ROOT}/${path}`, 'utf8')
const build = read('tools/control/scripts/template-build.sh')
const copied = actor_folders()
const called = [build, read('server/host/guest/brayness-recover')].flatMap(
  text =>
    [
      ...text.matchAll(/\/usr\/local\/lib\/(brayness[\w-]*\/[\w./-]+\.js)/g)
    ].map(match => match[1])
)

const check_imports = (path, seen = new Set()) => {
  if (seen.has(path)) return
  seen.add(path)
  const folder = path.slice(0, path.lastIndexOf('/'))
  assert.ok(
    copied.includes(folder),
    `${RUNTIME}${path}: ${folder} is not copied`
  )
  const require = create_require(`${ROOT}/${path}`)
  for (const [, specifier] of read(path).matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g
  )) {
    if (specifier.startsWith('node:')) continue
    assert.ok(
      specifier.startsWith('.') || specifier.startsWith('#root/'),
      `${path} imports external runtime code: ${specifier}`
    )
    check_imports(relative(ROOT, require.resolve(specifier)), seen)
  }
}

test('every runtime file a guest wrapper calls is copied into the template', () => {
  assert.ok(called.length >= 2, 'expected the actor sync and recovery wrappers')
  assert.match(
    build,
    /bash "\$REPO\/tools\/control\/scripts\/stage-runtime\.sh" "\$runtime"/
  )
  for (const full of called) {
    assert.ok(
      full.startsWith('brayness/'),
      `/usr/local/lib/${full} is outside the runtime`
    )
    const path = full.slice('brayness/'.length)
    const folder = path.slice(0, path.lastIndexOf('/'))
    assert.ok(
      copied.includes(folder),
      `${RUNTIME}${path}: ${folder} is not copied`
    )
    assert.ok(
      exists_sync(`${ROOT}/${path}`),
      `${path} does not exist in the repo`
    )
    check_imports(path)
  }
})

test('the copied actor CLI and its cloud dependency chain load from the staged tree', t => {
  const artifacts = `${ROOT}/../../artifacts/brayness/guest-runtime-tests/`
  mkdir_sync(artifacts, { recursive: true })
  const scratch = mkdtemp_sync(join(artifacts, 'runtime-check-'))
  t.after(() => rm_sync(scratch, { recursive: true, force: true }))
  exec_file_sync('bash', ['tools/control/scripts/stage-runtime.sh', scratch], {
    cwd: ROOT,
    encoding: 'utf8'
  })
  assert.equal(exists_sync(join(scratch, 'node_modules')), false)
  const options = {
    cwd: scratch,
    encoding: 'utf8',
    env: { ...process.env, BRAYNESS_ACTOR: '1', PROFILE: 'actor' }
  }
  const help = exec_file_sync(
    process.execPath,
    ['tools/cli/bin/brayness.js', '--help'],
    options
  )
  assert.match(help, /files sync/)
  const loaded = exec_file_sync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "globalThis.fetch = () => { throw Error('network must stay unused') }; const { cloud_sources } = await import('./src/command/watch-cloud.js'); if (typeof cloud_sources !== 'function') throw Error('missing cloud source')"
    ],
    options
  )
  assert.equal(loaded, '')
})

test('harness extensions call the brayness command, never a runtime file path', () => {
  const harness = JSON.parse(
    read_file_sync(`${ROOT}/../../package.json`, 'utf8')
  )
  const extensions = `${ROOT}/../../${harness.pi.extensions[0]}`
  const named = readdir_sync(extensions, { recursive: true })
    .filter(name => /\.(ts|js)$/.test(name) && !name.includes('node_modules'))
    .filter(name =>
      /\/usr\/local\/lib\/brayness/.test(
        read_file_sync(`${extensions}/${name}`, 'utf8')
      )
    )
  assert.deepEqual(named, [])
  assert.match(build, /export BRAYNESS_ACTOR=1/)
  assert.match(
    build,
    /turn-end\|fetch\|git-credential\|files\|store\|login\|logout\|whoami\|ls\|cat\|cp\|rm\|example\)/
  )
})
