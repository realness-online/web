/**
 * gz2d: git carries a repo, so sync skips it, and another device would never
 * know it was there. Beside each repo under a person's own folders, sync
 * writes `<folder>.md` with its remote and branch. A file of that name that
 * sync did not write is left alone.
 */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import {
  readFile as read_file,
  readdir,
  writeFile as write_file
} from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import { skipped_name } from '#root/src/files/skip.js'

const run = promisify(exec_file)
const MARK = 'generated: realness sync'

/** One git value, or null when git has none. */
const git = (dir, ...args) =>
  run('git', ['-C', dir, ...args]).then(
    ({ stdout }) => stdout.trim() || null,
    () => null
  )

/** Every repo below `folder`, root-relative, not looking inside a repo. */
export const find_repos = async (root, folder) => {
  const found = []
  const visit = async path => {
    if (exists_sync(join(root, path, '.git'))) return found.push(path)
    const entries = await readdir(join(root, path), {
      withFileTypes: true
    }).catch(() => [])
    for (const entry of entries)
      if (entry.isDirectory() && !skipped_name(entry.name))
        // eslint-disable-next-line no-await-in-loop -- one folder at a time bounds open files
        await visit(`${path}/${entry.name}`)
  }
  await visit(folder)
  return found
}

/** The note for one repo. */
export const repo_note = ({ name, remote, branch }) =>
  [
    '---',
    MARK,
    '---',
    '',
    `# ${name}`,
    '',
    `- Remote: ${remote ?? 'local only'}`,
    `- Branch: ${branch ?? 'none'}`,
    ''
  ].join('\n')

/**
 * Write or refresh `<repo>.md` beside each repo under `folders`. Returns the
 * notes written; unchanged and hand-written files are skipped.
 * @param {string} root
 * @param {string[]} folders root-relative, e.g. `['work', 'vault']`
 */
export const describe_repos = async (root, folders) => {
  const written = []
  for (const folder of folders)
    // eslint-disable-next-line no-await-in-loop -- folders are few
    for (const repo of await find_repos(root, folder)) {
      const dir = join(root, repo)
      const note = repo_note({
        name: basename(repo),
        // eslint-disable-next-line no-await-in-loop -- one git call at a time
        remote: await git(dir, 'remote', 'get-url', 'origin'),
        // eslint-disable-next-line no-await-in-loop -- one git call at a time
        branch: await git(dir, 'branch', '--show-current')
      })
      const path = `${dir}.md`
      // eslint-disable-next-line no-await-in-loop -- read beside its write
      const current = await read_file(path, 'utf8').catch(() => null)
      if (current === note || (current !== null && !current.includes(MARK)))
        continue
      // eslint-disable-next-line no-await-in-loop -- one note at a time
      await write_file(path, note)
      written.push(`${repo}.md`)
    }

  return written
}
