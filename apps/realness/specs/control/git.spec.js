import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { it } from 'node:test'
import { fileURLToPath as file_url_to_path } from 'node:url'

const app = file_url_to_path(new URL('../../', import.meta.url))
const git = file_url_to_path(new URL('../../scripts/git.sh', import.meta.url))

it('release scripts reach the repository from the app, wherever it lives', () => {
  const inside = exec_file_sync(git, ['rev-parse', '--is-inside-work-tree'], {
    cwd: app,
    encoding: 'utf8'
  })
  assert.equal(inside.trim(), 'true')
})
