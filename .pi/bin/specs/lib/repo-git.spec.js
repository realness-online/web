import { it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync } from 'node:fs'
import { join } from 'node:path'
import { REPO_DIR, has_repo, repo_args } from '../../lib/repo-git.js'

const scratch = (...dirs) => {
  const root = mkdtemp_sync(join(process.env.TMPDIR ?? 'artifacts/tmp', 'repo-git-'))
  for (const dir of dirs) mkdir_sync(join(root, dir), { recursive: true })
  return root
}

it('a root without .git uses the repository beside it, with the root as worktree', () => {
  const root = scratch(REPO_DIR)
  try {
    assert.deepEqual(repo_args(root), [`--git-dir=${join(root, REPO_DIR)}`, `--work-tree=${root}`])
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
})

it('a root with its own .git, as a scratch repo has, is used as it is', () => {
  const root = scratch('.git', REPO_DIR)
  try {
    assert.deepEqual(repo_args(root), ['-C', root])
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
})

it('a plain folder is asked as itself, and is no checkout', () => {
  const root = scratch()
  try {
    assert.deepEqual(repo_args(root), ['-C', root])
    assert.equal(has_repo(root), false)
  } finally {
    rm_sync(root, { recursive: true, force: true })
  }
})
