import assert from 'node:assert/strict'
import { readFileSync as read_file_sync } from 'node:fs'
import { it } from 'node:test'

const read = path =>
  read_file_sync(new URL(`../../${path}`, import.meta.url), 'utf8')
const build = read('tools/control/scripts/runtime-build.sh')
const serve = read('server/halo/guest/realness-serve.js')

it('every #root import of the app server is installed beside it', () => {
  const imports = [...serve.matchAll(/from '#root\/([^']+)'/g)].map(
    ([, path]) => path
  )
  assert.ok(imports.length > 0)
  for (const path of imports)
    assert.ok(
      build.includes(`"$REPO/${path}" "$work/node/realness/${path}"`),
      `${path} is not installed`
    )
  assert.match(build, /"#root\/\*": "\.\/\*"/)
})

it('runtime disks never follow the artifacts folder that output.sh exports as OUT', () => {
  assert.doesNotMatch(build, /\$OUT\b|\bOUT=/)
})
