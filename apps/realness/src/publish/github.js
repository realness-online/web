/**
 * Publish a built app to a GitHub Pages branch with the person's own git login.
 *
 * The branch's history is kept: each publish is one commit on top, replacing
 * the whole tree with `dist/`. A user or organization Pages site serves from
 * the domain root, so links need no rewriting. No keys enter the app.
 */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { cp, mkdir, readdir, readFile as read_file, rm, writeFile as write_file } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(exec_file)
/** Files the branch keeps across publishes: a custom domain stays attached. */
const KEPT = ['CNAME']

/** `owner/repo` means GitHub over SSH; anything else is a git remote as given. */
export const github_remote = (repository) => /^[\w.-]+\/[\w.-]+$/.test(repository) ? `git@github.com:${repository}.git` : repository

/**
 * @param {{dist: string, work: string, repository: string, branch?: string, message: string, push?: boolean}} options
 * @returns {Promise<{changed: boolean, pushed: boolean, summary: string}>}
 */
export const publish_github = async ({ dist, work, repository, branch = 'gh-pages', message, push = true }) => {
  if (!repository) throw new Error('publish --github needs owner/repo')
  const git = async (...args) => (await run('git', ['-C', work, ...args], { maxBuffer: 64 << 20 })).stdout.trim()
  if (!exists_sync(join(work, '.git'))) {
    await mkdir(work, { recursive: true })
    await git('init', '--quiet')
    await git('remote', 'add', 'origin', github_remote(repository))
  } else await git('remote', 'set-url', 'origin', github_remote(repository))

  let existing = true
  try { await git('fetch', '--quiet', '--depth', '1', 'origin', branch) } catch { existing = false }
  if (existing) await git('checkout', '--quiet', '--force', '-B', branch, 'FETCH_HEAD')
  else await git('checkout', '--quiet', '--orphan', branch)

  const kept = []
  for (const name of KEPT) if (exists_sync(join(work, name))) kept.push({ name, bytes: await read_file(join(work, name)) })
  for (const entry of await readdir(work)) if (entry !== '.git') await rm(join(work, entry), { recursive: true, force: true })
  await cp(dist, work, { recursive: true })
  await write_file(join(work, '.nojekyll'), '')
  for (const { name, bytes } of kept) await write_file(join(work, name), bytes)

  await git('add', '--all')
  if (!(await git('status', '--porcelain'))) return { changed: false, pushed: false, summary: 'no changes' }
  const summary = existing ? await git('diff', '--cached', '--shortstat', 'HEAD') : 'first publish'
  await git('commit', '--quiet', '-m', message)
  if (push) await git('push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`)
  return { changed: true, pushed: push, summary }
}
