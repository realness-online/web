import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { diff_of, unformatted } from '../../checks/format.js'

const harness = join(dirname(file_url_to_path(import.meta.url)), '../../..')
const scratch = 'bin/specs/checks/format-fixture'

it('names a badly formatted file and shows the change from the repo root', () => {
  mkdir_sync(join(harness, scratch), { recursive: true })
  const path = `${scratch}/bad.js`
  write_file_sync(join(harness, path), 'const a = {b:1};\n')
  try {
    assert.ok(unformatted().includes(path))
    const diff = diff_of(path)
    assert.match(diff, /^--- \.pi\/bin\/specs\/checks\/format-fixture\/bad\.js/m)
    assert.match(diff, /^-const a = \{b:1\};$/m)
    assert.match(diff, /^\+const a = \{ b: 1 \}$/m)
  } finally {
    rm_sync(join(harness, scratch), { recursive: true, force: true })
  }
})
