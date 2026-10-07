// The actor template copies root source folders into /usr/local/lib/brayness;
// guest wrappers call files there by path. A folder move must move both.
import assert from 'node:assert/strict'
import {
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { createRequire as create_require } from 'node:module'
import { relative } from 'node:path'
import { test } from 'node:test'
import { ROOT } from '../src/paths.js'

const RUNTIME = '/usr/local/lib/brayness/'
const read = path => read_file_sync(`${ROOT}/${path}`, 'utf8')
const build = read('tools/control/scripts/template-build.sh')
const copied = /for folder in ([^;]+); do\n\s+mkdir -p "\$runtime\/\$folder"/
  .exec(build)[1]
  .trim()
  .split(/\s+/)
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
  assert.ok(copied.includes(folder), `${RUNTIME}${path}: ${folder} is not copied`)
  const require = create_require(`${ROOT}/${path}`)
  for (const [, specifier] of read(path).matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g)) {
    if (specifier.startsWith('node:')) continue
    assert.ok(specifier.startsWith('.') || specifier.startsWith('#root/'), `${path} imports external runtime code: ${specifier}`)
    check_imports(relative(ROOT, require.resolve(specifier)), seen)
  }
}

test('every runtime file a guest wrapper calls is copied into the template', () => {
  assert.ok(called.length >= 2, 'expected the actor sync and recovery wrappers')
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

// Harness extensions run inside actors; only the guest wrappers may know the runtime layout.
test('harness extensions call the brayness command, never a runtime file path', () => {
  const harness = JSON.parse(read_file_sync(`${ROOT}/../../package.json`, 'utf8'))
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
  assert.match(build, /turn-end\|files\|store\|login\|logout\|whoami\|ls\|cat\|cp\|rm\|example\)/)
})
