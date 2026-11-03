import {
  existsSync as exists_sync,
  lstatSync as lstat_sync,
  readFileSync as read_file_sync,
  renameSync as rename_sync,
  rmSync as rm_sync,
  symlinkSync as symlink_sync
} from 'node:fs'
import { createHash as create_hash } from 'node:crypto'
import { join, relative } from 'node:path'
import { verify_modules } from './pi-release.js'

const agent_package = '@earendil-works/pi-coding-agent'

/** A release keeps its own node_modules, so a live session keeps the files it loaded. */
export const modules_name = release => {
  const archives = Object.keys(release.archives)
    .sort()
    .map(path => `${path}:${release.archives[path]}`)
    .join('\n')
  const digest = create_hash('sha256').update(archives).digest('hex').slice(0, 10)
  return `node_modules-${release.source_commit.slice(0, 12)}-${digest}`
}

/** True when these modules hold the pinned release and every command links inside them. */
export const modules_ready = (modules, release) => {
  const manifest = join(modules, agent_package, 'package.json')
  if (!exists_sync(manifest)) return false
  if (JSON.parse(read_file_sync(manifest, 'utf8')).version !== release.version) return false
  try {
    verify_modules(modules)
  } catch {
    return false
  }
  return true
}

/** Point the runtime at a release without editing the modules a running session holds. */
export const activate_modules = (runtime, target) => {
  const modules = join(runtime, 'node_modules')
  const writing = join(runtime, `.node_modules-${process.pid}`)
  rm_sync(writing, { force: true })
  symlink_sync(relative(runtime, target), writing, 'dir')
  if (!exists_sync(modules)) {
    rename_sync(writing, modules)
    return null
  }
  if (lstat_sync(modules).isSymbolicLink()) {
    rename_sync(writing, modules)
    return null
  }
  let backup = join(runtime, `node_modules-prev-${Date.now()}`)
  for (let n = 2; exists_sync(backup); n++) backup = join(runtime, `node_modules-prev-${Date.now()}-${n}`)
  rename_sync(modules, backup)
  rename_sync(writing, modules)
  return backup
}
