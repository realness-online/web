/**
 * What `realness sync` carries: the whole harness, at `can://~/harness/`,
 * minus fixed ignores (skip.js), the person's `.ignore`, git repos,
 * and files over the upload limit. Pi session history goes first. Without a
 * `.ignore`, only the plans' Syncs paths and history sync, as before.
 *
 */
import { execFile as exec_file } from 'node:child_process'
import { existsSync as exists_sync } from 'node:fs'
import { mkdir, readFile as read_file, readdir, stat } from 'node:fs/promises'
import {
  basename,
  dirname,
  extname,
  isAbsolute as is_absolute,
  join,
  normalize,
  relative,
  resolve
} from 'node:path'
import { promisify } from 'node:util'
import { version_sync } from '#root/src/files/version-node.js'
import { writeFile as write_file } from 'node:fs/promises'
import { apply, load_calls } from '#root/src/files/replay.js'
import { ignorer, parse_ignore } from '#root/src/files/ignore.js'
import { skipped } from '#root/src/files/skip.js'
import { state_path, harness_root } from './settings.js'
import { state_dir } from '#root/src/files/client.js'
import { plans_path, runtime_sessions_path } from './settings.js'
import { STARTER_DIRECTORY, STARTER_FILE } from '#root/src/files/starter.js'
import { read_skipped } from './light.js'
import { HTTP } from '#root/lib/http.js'
/* eslint-disable no-await-in-loop -- harness paths sync one at a time so a failure stops the rest */

/** Edits a later actor must replay: harness path to base, target, and calls. */
const DEFERRED = 'can://~/.pi/agent/deferred.json'
/** Where a whole harness lives in storage. */
export const HARNESS = 'can://~/harness/'
const HARNESS_DEFERRED = `${HARNESS}.pi/agent/deferred.json`
/** A person's own ignore rules, at the harness root. */
const IGNORE_FILE = '.ignore'
/** The whole harness syncs once its ignore file exists here or in storage. */
export const whole_enabled = (root, store) => {
  if (exists_sync(join(root, IGNORE_FILE))) return true
  if (!store?.cat) return false
  return store.cat(`${HARNESS}${IGNORE_FILE}`).then(
    () => true,
    error => {
      if (error.status === HTTP.NOT_FOUND) return false
      throw error
    }
  )
}
const INTERNAL = ['.pi/agent/deferred.json', '.pi/agent/memory.db']
const is_internal = (path, sessions) =>
  [sessions, ...INTERNAL].some(
    name =>
      path === name ||
      path.startsWith(`${name}/`) ||
      path.startsWith(`${name}-`)
  )
const sha = version_sync

const run = promisify(exec_file)

export const use_harness_state = root => state_dir(root)

/** The state folder as a harness path, when it sits inside the harness. */
const inside_state = (root, state = state_dir(root)) => {
  const path = relative(root, state)
  return path && !path.startsWith('..') && !is_absolute(path)
    ? path.split('\\').join('/')
    : null
}

/** The nearest harness package, ignore file, Pi config, or vault plans. */
export const find_root = (start = process.cwd()) => {
  const root = harness_root(start)
  if (!root)
    throw new Error(
      'no harness here: no harness package.json, .ignore, .pi/agent, or vault/plans/ above'
    )
  return root
}

/** List items under `## Syncs`, until the next heading of that level or higher. */
export const syncs_of = markdown => {
  const paths = []
  let inside = false
  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(line)
    if (heading) inside = heading[2].trim().toLowerCase() === 'syncs'
    else if (inside) {
      const item = /^\s*[-*]\s+`?([^`]+?)`?\s*$/.exec(line)
      if (item) paths.push(item[1])
    }
  }
  return paths
}

/** Why a path cannot sync, or null. */
export const refused = path => {
  if (is_absolute(path)) return 'absolute'
  const clean = normalize(path).replace(/\/$/, '')
  if (clean === '.' || clean.startsWith('..')) return 'outside the harness'
  if (skipped(clean)) return 'never syncs'
  return null
}

/** o3: a Syncs entry naming an org folder, `orgs/+name` or deeper. */
export const org_path = path =>
  /^orgs\/\+[a-z][a-z0-9-]{0,62}(\/[^/]+)*\/?$/.test(path)

/**
 * Sync one org folder at `can://orgs/+name/...`. Sync decides access: the
 * Syncs list only narrows it. When the owner is no longer a member, sync
 * refuses, the folder stops syncing, and files already here stay.
 * No `members.html` travels; the founder edits them through sync directly.
 */
export const sync_org = async (store, local, path, options) => {
  const folder = path.replace(/\/$/, '')
  const exclude = options.exclude ?? (() => false)
  try {
    const report = await store.sync(local, `can://${folder}/`, {
      ...options,
      exclude: (name, is_dir) =>
        name.split('/').at(-1) === 'members.html' || exclude(name, is_dir)
    })
    return { report }
  } catch (error) {
    if (error.status === HTTP.FORBIDDEN || error.status === HTTP.NOT_FOUND)
      return { refused: 'not a member of this org' }
    throw error
  }
}

/** The repo a path sits in, checked from its nearest existing folder. */
const repo_of = async path => {
  let dir = resolve(path)
  while (!exists_sync(dir)) dir = dirname(dir)
  try {
    const { stdout } = await run('git', [
      '-C',
      dir,
      'rev-parse',
      '--show-toplevel'
    ])
    return stdout.trim()
  } catch {
    return null
  }
}

/** A Syncs entry is a file when it exists as one, or names a file extension. */
export const is_file_entry = async (root, path) => {
  const info = await stat(join(root, path)).catch(() => null)
  if (info) return info.isFile()
  return !path.endsWith('/') && extname(path) !== ''
}

/**
 * `(path, is_dir) => boolean` for root-relative paths: fixed ignores, the
 * person's `.ignore`, and anything inside a git repo (git carries it).
 */
export const harness_exclude = async (root, state = state_dir(root)) => {
  const states = [state_path(root), inside_state(root, state)].filter(Boolean)
  const ignored = ignorer(
    parse_ignore(
      await read_file(join(root, IGNORE_FILE), 'utf8').catch(() => '')
    )
  )
  const light = read_skipped(state)
  const repos = new Map()
  const is_repo = dir => {
    if (!repos.has(dir)) repos.set(dir, exists_sync(join(root, dir, '.git')))
    return repos.get(dir)
  }
  return (path, is_dir = false) => {
    if (!path || path === '.' || path.startsWith('..')) return false
    if (states.some(state => path === state || path.startsWith(`${state}/`)))
      return true
    if (skipped(path) || ignored(path, is_dir)) return true
    if (!is_dir && light.has(path)) return true
    const parts = path.split('/')
    for (let i = 1; i <= (is_dir ? parts.length : parts.length - 1); i++)
      if (is_repo(parts.slice(0, i).join('/'))) return true
    return false
  }
}

/** Every plan's Syncs paths, named plans only when given. */
export const plan_syncs = async (root, names = []) => {
  const folder = join(root, plans_path(root))
  const files = names.length
    ? names.map(name => (name.endsWith('.md') ? name : `${name}.md`))
    : (
        await readdir(folder).catch(error => {
          if (error.code === 'ENOENT') return []
          throw error
        })
      ).filter(name => name.endsWith('.md'))
  const found = new Map()
  for (const file of files) {
    const text = await read_file(join(folder, file), 'utf8')
    for (const path of syncs_of(text)) {
      const key = normalize(path).replace(/\/$/, '')
      if (!found.has(key)) found.set(key, file)
    }
  }
  found.set(runtime_sessions_path(root), 'harness')
  return found
}

/**
 * Sync every harness file, minus fixed and personal ignores. Sessions go first,
 * so any edit deferred to them is already saved. Without a `.ignore`, only the
 * plans' Syncs paths sync, at `can://~/<path>/`.
 */
/**
 * Sync the whole harness, or only the named plan files.
 * @param {object} options
 * @param {string} options.root
 * @param {{ cat: (path: string) => Promise<Buffer>, put: (path: string, bytes: Buffer) => Promise<string>, sync: (local: string, remote: string, options?: object) => Promise<import('#root/src/files/client.js').SyncReport> }} options.store
 * @param {string[]} [options.plans]
 * @param {string} [options.state]
 * @param {'all' | 'explained'} [options.deletes]
 * @param {boolean} [options.defer_edits]
 * @param {string | null} [options.starter]
 */
export const sync_harness = async ({
  root,
  store,
  plans = [],
  state: sync_state = state_dir(root),
  deletes = 'explained',
  defer_edits = false,
  starter = exists_sync(join(STARTER_DIRECTORY, STARTER_FILE))
    ? STARTER_DIRECTORY
    : null
}) => {
  if (!(await whole_enabled(root, store))) {
    const listed = await sync_listed({
      root,
      store,
      plans,
      state: sync_state,
      deletes,
      defer_edits
    })
    return {
      harness: null,
      synced: listed.synced,
      refused: listed.refused,
      applied: await settle(root, store, DEFERRED, listed.reports)
    }
  }
  await mkdir(join(root, 'apps'), { recursive: true })
  const exclude = await harness_exclude(root, sync_state)
  const SESSIONS = runtime_sessions_path(root)
  const sessions = join(root, SESSIONS)
  const options = {
    state: sync_state,
    deletes,
    sessions,
    sessions_remote: `${HARNESS}${SESSIONS}/`
  }
  const history = await store.sync(sessions, `${HARNESS}${SESSIONS}/`, {
    ...options,
    exclude: (path, is_dir) => exclude(`${SESSIONS}/${path}`, is_dir)
  })
  const state = inside_state(root, sync_state)
  const own_state = path =>
    state !== null && (path === state || path.startsWith(`${state}/`))
  const files = await store.sync(root, HARNESS, {
    ...options,
    starter,
    defer_edits,
    exclude: (path, is_dir) =>
      is_internal(path, SESSIONS) || own_state(path) || exclude(path, is_dir)
  })
  const applied = await settle(root, store, HARNESS_DEFERRED, [['', files]])
  return {
    harness: { sessions: history, files },
    synced: {},
    refused: {},
    applied: [...new Set(applied)].sort()
  }
}

/** Retire pending edits real bytes now settle, record new ones, then replay any pending. */
const settle = async (root, store, location, reports) => {
  const pending = await read_deferred(store, location)
  const applied = await apply_deferred(root, pending)
  let changed = false
  const key = (base, name) => (base ? `${base}/${name}` : name)
  for (const [base, report] of reports) {
    for (const name of [
      'pushed',
      'adopted',
      'replayed',
      'merged',
      'kept_both',
      'deleted',
      'removed'
    ].flatMap(kind => report[kind]))
      if (pending[key(base, name)]) {
        delete pending[key(base, name)]
        changed = true
      }

    for (const name of report.deferred)
      if (report.replay[name]) {
        pending[key(base, name)] = report.replay[name]
        changed = true
      }
  }
  if (changed && store.put)
    await store.put(location, `${JSON.stringify(pending, null, 2)}\n`)
  return applied
}

/** Without a `.ignore`: each plan's Syncs paths at `can://~/<path>/`. Refused paths are named, never synced. */
const sync_listed = async ({
  root,
  store,
  plans,
  state,
  deletes,
  defer_edits
}) => {
  const SESSIONS = runtime_sessions_path(root)
  const exclude = await harness_exclude(root, state)
  const synced = {}
  const refusals = {}
  const bases = {}
  const paths = await plan_syncs(root, plans)
  for (const [path, plan] of [...paths].sort(
    ([a], [b]) => Number(b === SESSIONS) - Number(a === SESSIONS)
  )) {
    const local = join(root, path)
    const reason =
      refused(path) ?? ((await repo_of(local)) ? 'inside a git repo' : null)
    if (reason) refusals[path] = `${reason} (${plan})`
    else if (org_path(path)) {
      const { report, refused: why } = await sync_org(store, local, path, {
        state,
        deletes,
        defer_edits,
        exclude: (name, is_dir) => exclude(`${path}/${name}`, is_dir)
      })
      if (why) refusals[path] = `${why} (${plan})`
      else {
        synced[path] = report
        bases[path] = path
      }
    } else if (await is_file_entry(root, path)) {
      const folder = dirname(path)
      const remote = folder === '.' ? 'can://~/' : `can://~/${folder}/`
      synced[path] = await store.sync(dirname(local), remote, {
        state,
        deletes,
        defer_edits,
        sessions: join(root, SESSIONS),
        sessions_remote: `can://~/${SESSIONS}/`,
        only: [basename(path)],
        exclude: (name, is_dir) => exclude(join(folder, name), is_dir)
      })
      bases[path] = folder === '.' ? '' : folder
    } else {
      synced[path] = await store.sync(local, `can://~/${path}/`, {
        state,
        deletes,
        defer_edits: defer_edits && path !== SESSIONS,
        sessions: join(root, SESSIONS),
        sessions_remote: `can://~/${SESSIONS}/`,
        exclude: (name, is_dir) => exclude(`${path}/${name}`, is_dir)
      })
      bases[path] = path
    }
  }
  const reports = Object.entries(synced)
    .filter(([path]) => path !== SESSIONS)
    .map(([path, report]) => [bases[path], report])
  return { synced, refused: refusals, reports }
}

const read_deferred = async (store, location) => {
  if (!store.cat) return {}
  try {
    return JSON.parse((await store.cat(location)).toString())
  } catch (error) {
    if (error.status === HTTP.NOT_FOUND) return {}
    throw error
  }
}

/**
 * Rebuild deferred files from saved history: only where the local bytes are
 * exactly the saved base and the replay yields exactly the recorded target.
 */
export const apply_deferred = async (root, pending) => {
  const SESSIONS = runtime_sessions_path(root)
  const applied = []
  for (const [path, { base_sha, target_sha, calls }] of Object.entries(
    pending
  )) {
    if (refused(path)) continue
    const file = join(root, path)
    const bytes = await read_file(file).catch(() => null)
    if (!bytes || sha(bytes) !== base_sha) continue
    const rows = calls.map(({ session, tool_call }) => ({
      session: join(root, SESSIONS, session),
      tool_call
    }))
    if (rows.some(row => !row.session.startsWith(`${join(root, SESSIONS)}/`)))
      continue
    const replayed = apply(bytes.toString('utf8'), await load_calls(rows))
    if (replayed === null || sha(Buffer.from(replayed)) !== target_sha) continue
    await write_file(file, replayed)
    applied.push(path)
  }
  return applied.sort()
}
