/**
 * s1 cleanup: fold the `.conflict` session copies that keep-both left behind
 * back into their originals. Each merged copy goes to the Trash locally and
 * is removed from storage, so other machines trash theirs on their next sync.
 * A copy that does not merge (not a session, or another session) stays.
 */
import {
  readFile as read_file,
  readdir,
  writeFile as write_file
} from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { merge_session } from '#root/src/files/session-merge.js'
import { trash_dir, to_trash } from '#root/src/files/client.js'
import { HARNESS } from './harness.js'

import { runtime_sessions_path } from './settings.js'
import { HTTP } from '#root/lib/http.js'
/* eslint-disable no-await-in-loop -- conflict copies fold into their original one at a time */
const COPY = /\.conflict(?:-\d+)?\.(jsonl|html|html\.gz)$/

const file_of = (dir, entry) => (entry.isFile() ? [join(dir, entry.name)] : [])

const walk = async dir => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(
    entries.map(entry =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : file_of(dir, entry)
    )
  )
  return files.flat()
}

/**
 * Merge `.conflict` session copies back into their originals.
 * @param {object} options
 * @param {string} options.root
 * @param {{ rm: (path: string) => Promise<void> }} options.store
 * @param {string} options.state
 * @param {boolean} [options.dry_run]
 * @returns {Promise<{ folded: string[], left: string[] }>}
 */
export const fold_conflicts = async ({
  root,
  store,
  state,
  dry_run = false
}) => {
  const SESSIONS = runtime_sessions_path(root)
  const folder = join(root, SESSIONS)
  /** @type {{ folded: string[], left: string[] }} */
  const report = { folded: [], left: [] }
  const copies = (await walk(folder)).filter(file => COPY.test(file)).sort()
  const merged = new Map()
  const read = new Map()
  for (const copy of copies) {
    const original = copy.replace(COPY, '.$1')
    if (!read.has(original))
      read.set(original, await read_file(original).catch(() => null))
    const ours = merged.get(original) ?? read.get(original)
    const name = relative(folder, copy).split(sep).join('/')
    const result = ours && merge_session(original, ours, await read_file(copy))
    if (!result) {
      report.left.push(name)
      continue
    }
    merged.set(original, result)
    report.folded.push(name)
  }
  if (dry_run) return report
  for (const [original, bytes] of merged) {
    if (!(await read_file(original)).equals(read.get(original))) {
      merged.delete(original)
      continue
    }
    if (!bytes.equals(read.get(original))) await write_file(original, bytes)
  }
  const busy = report.folded.filter(
    name => !merged.has(join(folder, ...name.split('/')).replace(COPY, '.$1'))
  )
  report.folded = report.folded.filter(name => !busy.includes(name))
  report.left.push(...busy)
  const trash = trash_dir(state)
  for (const name of report.folded) {
    await store.rm(`${HARNESS}${SESSIONS}/${name}`).catch(error => {
      if (error.status !== HTTP.NOT_FOUND) throw error
    })
    await to_trash(join(folder, ...name.split('/')), trash)
  }
  return report
}
