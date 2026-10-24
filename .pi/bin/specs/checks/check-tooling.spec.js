import { it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync as exec_file_sync } from 'node:child_process'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const artifacts = file_url_to_path(new URL('../../../../artifacts/tooling/', import.meta.url))
const checker = file_url_to_path(new URL('../../checks/check-tooling.js', import.meta.url))

const fixture = t => {
  mkdir_sync(artifacts, { recursive: true })
  const root = mkdtemp_sync(join(artifacts, 'test-'))
  t.after(() => rm_sync(root, { recursive: true, force: true }))
  const git = (...args) => exec_file_sync('git', ['-C', root, ...args], { encoding: 'utf8' })
  const write = (path, text) => {
    mkdir_sync(join(root, path, '..'), { recursive: true })
    write_file_sync(join(root, path), text)
  }
  git('init', '-q')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.test')
  write('apps/example/package.json', JSON.stringify({ scripts: { test: 'echo test', build: 'echo build' } }))
  write('apps/example/.tooling.md', '# Tooling\n\nRun `npm test`.\n')
  git('add', '.')
  git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture')
  const run = () => {
    try {
      return { status: 0, output: exec_file_sync(process.execPath, [checker, root], { encoding: 'utf8' }) }
    } catch (error) {
      return { status: error.status, output: `${error.stdout}${error.stderr}` }
    }
  }
  return { write, git, run }
}

it('real command accepts valid notes and optional missing notes', t => {
  const { write, run } = fixture(t)
  write('apps/other/package.json', '{}')
  assert.equal(run().status, 0)
})

it('real command rejects excessive text, stale scripts, and broken links', t => {
  const { write, run } = fixture(t)
  write('apps/example/.tooling.md', '# Tooling\n' + '\n'.repeat(40) + 'word '.repeat(401) + '\n`npm run gone`\n[missing](gone.md)\n')
  const result = run()
  assert.equal(result.status, 1)
  for (const message of ['over 40 lines', 'over 400 words', 'unknown script', 'missing link']) assert.ok(result.output.includes(message), result.output)
})

it('documented script changes need review; other scripts and helpers do not', t => {
  const { write, git, run } = fixture(t)
  write('apps/example/package.json', JSON.stringify({ scripts: { test: 'echo test', build: 'echo changed' } }))
  write('apps/example/tools/helper.js', 'export const value = 1\n')
  git('add', '.')
  assert.equal(run().status, 0)
  write('apps/example/package.json', JSON.stringify({ scripts: { test: 'echo changed', build: 'echo changed' } }))
  git('add', '.')
  assert.match(run().output, /review and stage apps\/example\/\.tooling.md/)
  assert.equal(run().status, 1)
  write('apps/example/.tooling.md', '# Tooling\n\nRun `npm test`: updated tests.\n')
  git('add', '.')
  assert.equal(run().status, 0)
})

it('declared packages and npm prefixes resolve from the command directory', t => {
  const { write, run } = fixture(t)
  write('apps/example/frontend/.tooling.md', 'Package: `apps/example`.\n\n`npm run build`\n`npm --prefix ../../apps/example run test`\n')
  assert.equal(run().status, 0)
})
