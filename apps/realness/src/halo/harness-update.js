import {
  chmodSync as chmod_sync,
  chownSync as chown_sync,
  copyFileSync as copy_file_sync,
  existsSync as exists_sync,
  lstatSync as lstat_sync,
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  statSync as stat_sync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'

export const STARTER = 'usr/local/share/realness-starter'
export const WORKSPACE = 'realness'
const PI_RUNTIME = '.pi/runtime/'

/**
 * Regular files under a root, as paths relative to it.
 * @param {string} root
 * @returns {string[]}
 */
const files_under = root => {
  if (!exists_sync(root)) return []
  return readdir_sync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(root, join(entry.parentPath, entry.name)))
    .filter(path => !path.startsWith(PI_RUNTIME))
}

/** @param {string} path */
const bytes = path => {
  try {
    return lstat_sync(path).isFile() ? read_file_sync(path) : null
  } catch {
    return null
  }
}

/**
 * Creates missing parents, owned like the matching directories in the release.
 * @param {string} target
 * @param {string} workspace
 * @param {string} release
 */
const make_parents = (target, workspace, release) => {
  const missing = []
  for (
    let at = dirname(target);
    !exists_sync(at) && at.startsWith(workspace);
    at = dirname(at)
  )
    missing.unshift(at)
  for (const at of missing) {
    mkdir_sync(at)
    const like = join(release, relative(workspace, at))
    if (exists_sync(like)) {
      const { uid, gid, mode } = stat_sync(like)
      chown_sync(at, uid, gid)
      chmod_sync(at, mode)
    }
  }
}

/**
 * Copies one release file into the workspace with the release's owner and mode.
 * @param {string} from
 * @param {string} to
 */
const install = (from, to) => {
  copy_file_sync(from, to)
  const { uid, gid } = stat_sync(from)
  chown_sync(to, uid, gid)
}

/**
 * Brings a stopped actor's harness up to the template's release without
 * overwriting the person's changes. Three copies decide each file: the
 * release the actor shipped with, the actor's workspace, and the new release.
 * A file the person never changed follows the release; a changed one stays.
 * @param {{ fresh: string, actor: string }} roots mounted template and actor disks
 * @returns {{ updated: string[], removed: string[], kept: string[] }}
 */
export const update_harness = ({ fresh, actor }) => {
  const release = join(fresh, STARTER)
  const shipped = join(actor, STARTER)
  const workspace = join(actor, WORKSPACE)
  const updated = []
  const removed = []
  const kept = []
  const next_files = new Set(files_under(release))
  for (const path of next_files) {
    const next = bytes(join(release, path))
    const before = bytes(join(shipped, path))
    const target = join(workspace, path)
    const current = bytes(target)
    if (next && current?.equals(next)) continue
    const person_deleted = current === null && before !== null
    const person_changed = current !== null && !before?.equals(current)
    if (person_deleted || person_changed) {
      kept.push(path)
      continue
    }
    make_parents(target, workspace, release)
    install(join(release, path), target)
    updated.push(path)
  }
  for (const path of files_under(shipped)) {
    if (next_files.has(path)) continue
    const target = join(workspace, path)
    const current = bytes(target)
    if (current === null) continue
    const before = bytes(join(shipped, path))
    if (before && current.equals(before)) {
      rm_sync(target)
      removed.push(path)
    } else kept.push(path)
  }
  rm_sync(shipped, { recursive: true, force: true })
  mkdir_sync(dirname(shipped), { recursive: true })
  for (const path of next_files) {
    const target = join(shipped, path)
    mkdir_sync(dirname(target), { recursive: true })
    install(join(release, path), target)
  }
  return { updated, removed, kept }
}
