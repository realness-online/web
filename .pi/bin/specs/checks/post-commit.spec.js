import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { existsSync as exists_sync, mkdirSync as mkdir_sync, rmSync as rm_sync, utimesSync as utimes_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join } from 'node:path'
import { has_repo, repo_args } from '../../lib/repo-git.js'

const root = join(import.meta.dirname, '../../../..')
const hook = join(root, '.pi/bin/hooks/post-commit')
const scratch = join(root, 'artifacts', `post-commit-test-${process.pid}`)
const stale = join(scratch, 'old/node_modules/pkg/index.js')

/** The hook as git runs it: from the root, with the repository named. */
const run_hook = () => {
  const git_dir = repo_args(root).find(arg => arg.startsWith('--git-dir='))?.slice('--git-dir='.length)
  return spawn_sync('bash', [hook], {
    cwd: root,
    env: { ...process.env, ARTIFACTS_ROOT: scratch, ...(git_dir ? { GIT_DIR: git_dir } : {}) },
    encoding: 'utf8'
  })
}

it('after a commit, prunes artifacts and says what it freed', { skip: !has_repo(root) && 'no repository' }, () => {
  mkdir_sync(join(scratch, 'old/node_modules/pkg'), { recursive: true })
  write_file_sync(join(scratch, 'old/package.json'), '{}')
  write_file_sync(stale, 'x'.repeat(2 * 1_048_576))
  const old = new Date(Date.now() - 2 * 3_600_000)
  for (const path of [stale, join(scratch, 'old/node_modules/pkg'), join(scratch, 'old/node_modules'), join(scratch, 'old/package.json'), join(scratch, 'old')])
    utimes_sync(path, old, old)
  try {
    const result = run_hook()
    assert.equal(result.status, 0, result.stderr)
    assert.ok(!exists_sync(stale))
    assert.match(result.stdout, /artifacts prune: freed 2 MiB/)
  } finally {
    rm_sync(scratch, { recursive: true, force: true })
  }
})

it('a prune that cannot run never fails the commit', () => {
  const result = spawn_sync('bash', [hook], {
    cwd: root,
    env: { ...process.env, ARTIFACTS_ROOT: '/not-inside-artifacts' },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
})
