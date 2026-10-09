/**
 * h4: light VMs. A harness whose package.json sets `brayness.light` starts
 * its VMs light: session history older than `days`, and any file over
 * `bytes`, stays in storage. The skipped names live in the state folder, so
 * the VM's own sync neither pulls them nor reads their absence as a delete.
 * Reading one fetches it: `brayness fetch <path>`, or the light-fetch hook.
 */
import { existsSync as exists_sync, readFileSync as read_file_sync } from 'node:fs'
import { mkdir, writeFile as write_file } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const SESSIONS = '.pi/agent/sessions'
export const LIGHT_DEFAULTS = { days: 14, bytes: 2 * 1024 * 1024 }
const FILE = 'light.json'

/** `brayness.light` from package.json text: null when unset, defaults filled in. */
export const light_policy = (package_text) => {
  if (!package_text) return null
  let light
  try {
    light = JSON.parse(package_text).brayness?.light
  } catch {
    return null
  }
  if (!light) return null
  const policy = { ...LIGHT_DEFAULTS, ...(light === true ? {} : light) }
  for (const key of ['days', 'bytes']) {
    if (!Number.isFinite(policy[key]) || policy[key] <= 0) throw new Error(`brayness.light.${key} must be a positive number`)
  }
  return policy
}

/** Names a light VM leaves in storage: any file over `bytes`, history older than `days`. */
export const light_skips = (listing, policy, now = Date.now()) => {
  const oldest = now - policy.days * 24 * 60 * 60 * 1000
  const skips = []
  for (const [name, { size, updated }] of Object.entries(listing)) {
    const old_history = name.startsWith(`${SESSIONS}/`) && Date.parse(updated) < oldest
    if (size > policy.bytes || old_history) skips.push(name)
  }
  return skips.sort()
}

/** The harness paths this VM left in storage; empty on a full VM or desktop. */
export const read_skipped = (state) => {
  const file = join(state, FILE)
  if (!exists_sync(file)) return new Set()
  return new Set(JSON.parse(read_file_sync(file, 'utf8')).skipped ?? [])
}

export const write_skipped = async (state, skipped) => {
  await mkdir(state, { recursive: true })
  await write_file(join(state, FILE), `${JSON.stringify({ skipped: [...skipped].sort() }, null, 2)}\n`)
}

/**
 * Pull one skipped file, then stop skipping it. A path that was never
 * skipped is left alone; the answer says which.
 */
export const fetch_skipped = async ({ root, state, store, path, remote = 'can://~/harness/' }) => {
  const skipped = read_skipped(state)
  if (!skipped.has(path)) return { path, fetched: false }
  const folder = dirname(path)
  const report = await store.sync(join(root, folder), `${remote}${folder === '.' ? '' : `${folder}/`}`, {
    state, only: [path.slice(folder === '.' ? 0 : folder.length + 1)], max_bytes: Infinity,
  })
  if (report.conflicts.length) throw new Error(`fetch ${path}: ${report.conflicts.join(', ')}`)
  skipped.delete(path)
  await write_skipped(state, skipped)
  return { path, fetched: true }
}
