/**
 * Git for a Realness checkout. The root keeps no `.git` (it would sync to
 * iCloud and turn every tool's search into a repo search); the repository
 * lives at `work/realness.git` with the root as its worktree. A root that does
 * have a `.git`, as a spec's scratch repo does, is used as it is.
 */
import { existsSync as exists_sync } from 'node:fs'
import { join } from 'node:path'

/** The repository beside the root, where `.pi/bin/rgit` looks too. */
export const REPO_DIR = 'work/realness.git'

/**
 * Whether this root is a checkout: its own `.git`, or the repository beside it.
 * @param {string} root
 */
export const has_repo = root => exists_sync(join(root, '.git')) || exists_sync(join(root, REPO_DIR))

/**
 * The arguments that point git at this root's repository.
 * @param {string} root the worktree
 * @returns {string[]}
 */
export const repo_args = root =>
  !exists_sync(join(root, '.git')) && exists_sync(join(root, REPO_DIR))
    ? [`--git-dir=${join(root, REPO_DIR)}`, `--work-tree=${root}`]
    : ['-C', root]
