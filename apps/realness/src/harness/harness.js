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
import { describe_repos } from './repos.js'
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
/**
 * gz2c: what is a person's own. Every harness starts from the same baseline,
 * so `.pi/`, `apps/`, and the rest never upload; sessions sync on their own.
 */
const OWN = new Set(['vault', 'work', 'AGENTS.md', IGNORE_FILE])
export const is_own = path => OWN.has(path.split('/')[0])

/** m0: sealed months of memory, kept beside the index, owner-only in the store. */
const MEMORY = '.pi/agent/memory'
const MEMORY_REMOTE = `${HARNESS}.memory/`
/** m0: a session from a month already over, by the month in its name. */
const SESSION_MONTH = /(?:^|\/)(\d{4}-\d{2})-\d{2}T[^/]*$/
const MONTH_CHARS = 7
export const is_past_session = (name, now = new Date()) => {
  const month = SESSION_MONTH.exec(name)?.[1]
  return month !== undefined && month < now.toISOString().slice(0, MONTH_CHARS)
}
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

/** Every item under `## Syncs`, until the next heading of that level or higher. */
const sync_items = markdown => {
  const items = []
  let inside = false
  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(line)
    if (heading) inside = heading[2].trim().toLowerCase() === 'syncs'
    else if (inside) {
      const item = /^\s*[-*]\s+`?([^`]+?)`?\s*$/.exec(line)
      if (item) items.push(item[1])
    }
  }
  return items
}

/** The paths a plan syncs; a `!path` item is an exclusion, not a path. */
export const syncs_of = markdown =>
  sync_items(markdown).filter(item => !item.startsWith('!'))

/** The paths a plan keeps out of what it syncs: `- !vault/Sessions`. */
export const sync_exclusions_of = markdown =>
  sync_items(markdown)
    .filter(item => item.startsWith('!'))
    .map(item => normalize(item.slice(1)).replace(/\/$/, ''))

/** Whether `path` is one of `paths` or inside one. */
export const within = (paths, path) =>
  [...paths].some(other => path === other || path.startsWith(`${other}/`))

/** Paths without any that another path already holds. */
export const outermost = paths =>
  paths.filter(
    path => !paths.some(other => other !== path && path.startsWith(`${other}/`))
  )

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
  const excluded = new Set()
  for (const file of files) {
    const text = await read_file(join(folder, file), 'utf8')
    for (const path of syncs_of(text)) {
      const key = normalize(path).replace(/\/$/, '')
      if (!found.has(key)) found.set(key, file)
    }
    for (const path of sync_exclusions_of(text)) excluded.add(path)
  }
  const kept = new Set(outermost([...found.keys()]))
  for (const key of Array.from(found.keys()))
    if (!kept.has(key) || within(excluded, key)) found.delete(key)
  found.set(runtime_sessions_path(root), 'harness')
  return Object.assign(found, { excluded })
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
 * @param {boolean} [options.repair] vlt2: forget record entries the store lost, and push those files again
 * @param {boolean} [options.defer_edits]
 * @param {string | null} [options.starter]
 * @param {boolean} [options.dry_run] sy16: report what would move, write nothing
 */
export const sync_harness = async ({
  root,
  store: live_store,
  dry_run = false,
  plans = [],
  state: sync_state = state_dir(root),
  deletes = 'explained',
  repair = false,
  defer_edits = false,
  starter = exists_sync(join(STARTER_DIRECTORY, STARTER_FILE))
    ? STARTER_DIRECTORY
    : null
}) => {
  const store = dry_run ? dry_store(live_store) : live_store
  const settled = (location, reports) =>
    dry_run ? [] : settle(root, store, location, reports)
  if (!(await whole_enabled(root, store))) {
    const listed = await sync_listed({
      root,
      store,
      plans,
      state: sync_state,
      deletes,
      repair,
      defer_edits
    })
    return {
      harness: null,
      synced: listed.synced,
      refused: listed.refused,
      applied: await settled(DEFERRED, listed.reports)
    }
  }
  if (!dry_run) await mkdir(join(root, 'apps'), { recursive: true })
  const exclude = await harness_exclude(root, sync_state)
  const SESSIONS = runtime_sessions_path(root)
  const sessions = join(root, SESSIONS)
  const options = {
    state: sync_state,
    deletes,
    repair,
    sessions,
    sessions_remote: `${HARNESS}${SESSIONS}/`
  }
  /** m0: a past session not on this device stays in the store; memory has it. */
  const elsewhere = path =>
    is_past_session(path) &&
    !exists_sync(join(sessions, path)) &&
    !exists_sync(join(sessions, `${path}.gz`))
  const history = await store.sync(sessions, `${HARNESS}${SESSIONS}/`, {
    ...options,
    exclude: (path, is_dir) =>
      (!is_dir && elsewhere(path)) || exclude(`${SESSIONS}/${path}`, is_dir)
  })
  const memory = await store.sync(join(root, MEMORY), MEMORY_REMOTE, {
    state: sync_state,
    deletes
  })
  const repos = dry_run ? [] : await describe_repos(root, ['work', 'vault'])
  const state = inside_state(root, sync_state)
  const own_state = path =>
    state !== null && (path === state || path.startsWith(`${state}/`))
  const files = await store.sync(root, HARNESS, {
    ...options,
    starter,
    defer_edits,
    exclude: (path, is_dir) =>
      !is_own(path) ||
      is_internal(path, SESSIONS) ||
      own_state(path) ||
      exclude(path, is_dir)
  })
  const applied = await settled(HARNESS_DEFERRED, [['', files]])
  return {
    harness: { sessions: history, files, memory, repos },
    synced: {},
    refused: {},
    applied: [...new Set(applied)].sort()
  }
}

/** sy16: a store whose syncs are dry runs and whose writes do nothing. */
const dry_store = store => ({
  ...store,
  sync: (local, remote, options = {}) =>
    store.sync(local, remote, { ...options, dry_run: true }),
  put: () => Promise.resolve(null)
})

/** Retire pending edits real bytes now settle, record new ones, then replay
 * any pending. An emptied map removes the remote record, so an idle handoff
 * stops syncing. */
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
  if (!changed) return applied
  if (Object.keys(pending).length) {
    if (store.put)
      await store.put(location, `${JSON.stringify(pending, null, 2)}\n`)
  } else if (store.rm) await store.rm(location)
  return applied
}

/** Without a `.ignore`: each plan's Syncs paths at `can://~/<path>/`. Refused paths are named, never synced. */
const sync_listed = async ({
  root,
  store,
  plans,
  state,
  deletes,
  repair,
  defer_edits
}) => {
  const SESSIONS = runtime_sessions_path(root)
  const paths = await plan_syncs(root, plans)
  const harness = await harness_exclude(root, state)
  /** A plan's `!path` stays home, as the harness ignores do. */
  const exclude = (path, is_dir) =>
    within(paths.excluded, path) || harness(path, is_dir)
  const synced = {}
  const refusals = {}
  const bases = {}
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
        repair,
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
        repair,
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
        repair,
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
