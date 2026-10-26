/**
 * A gsutil-like client for the sync service. Every call carries the phone
 * token and passes `can()`; nothing here touches storage directly.
 *
 *   can://people/+1…/vault/note.md   a remote path
 *   can://~/vault/note.md            the same, for whoever the token names
 *
 * `sync` is two-way and merges only Pi sessions (s1). A record outside the folder holds each
 * file's version at the last agreement: one hash of the plain bytes, the same
 * on disk, in the listing, and in the etag. A side that moved
 * from it wins. Both moving keeps both: theirs lands beside ours as
 * `x.conflict.ext`, and both travel. An edit beats a delete. A lost record is
 * safe: every file looks new, so identical ones match and the rest keep both.
 * A local delete travels only when the session edit log explains it, or with
 * `deletes: "all"`; the rest are held. Remote deletes move files to the Trash.
 * A remote change mid-run is left for the next run and reported as a conflict.
 */
import { promisify } from 'node:util'
import { gzip as gzip_callback } from 'node:zlib'
import { version_sync } from './version-node.js'
import { born, set_born } from './birth.js'
import {
  chmod,
  copyFile as copy_file,
  lstat,
  mkdir,
  readFile as read_file,
  readdir,
  rename,
  rm,
  stat,
  writeFile as write_file
} from 'node:fs/promises'
import { edit_log, edit_log_path } from './edits.js'
import { apply, is_session_file, load_calls, replayable } from './replay.js'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { merge_session } from './session-merge.js'
import { is_zipped, zip, zipped_call } from './zip.js'
import { skipped, skipped_name } from './skip.js'
import { trashed_from } from '#root/src/can/trash-keys.js'
import {
  STARTER_FILE,
  starter_base,
  starter_bytes,
  starter_choice
} from './starter.js'
import { harness_root, state_path } from '#root/src/harness/settings.js'
import { person_settings } from '#root/src/settings/environments.js'
import { HTTP } from '#root/lib/http.js'
import { MIB } from '#root/lib/units.js'
import { unsafe_part } from '#root/lib/path-parts.js'
/* eslint-disable no-await-in-loop -- a fixed pool of workers each takes the next file; tree walks bound open files */

const CONCURRENCY = 32
const KEY_LENGTH = 16
const MODE_BITS = 0o777
const MAX_MIB = 10

/** The person's own sync service. */
export const SYNC_URL = person_settings.services.sync_url

/** Sync records live here, never inside the folders they describe. */
export const state_dir = (root = harness_root()) =>
  root ? join(root, state_path(root)) : join(homedir(), '.local/state/realness')

export class SyncError extends Error {
  constructor(status, what) {
    super(`${what}: ${status}`)
    this.status = status
  }
}

const sha = version_sync
/** zlib's async gzip runs on libuv's worker pool, off the event loop. */
const gzip = promisify(gzip_callback)

/**
 * The upload for one body: `X-Version` always, gzip only when it shrinks.
 * @param {Buffer} bytes
 */
export const packed_upload = async bytes => {
  const headers = { 'x-version': sha(bytes) }
  const packed = await gzip(bytes)
  return packed.length < bytes.length
    ? { body: packed, headers: { ...headers, 'content-encoding': 'gzip' } }
    : { body: bytes, headers }
}

/** The phone number a token names, read locally only to build paths. */
export const phone_of = token => {
  if (!token) return null
  try {
    return (
      JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
        .phone_number ?? null
    )
  } catch {
    return null
  }
}

/** The sync service's upload limit (server.js LIMIT). */
export const MAX_BYTES = MAX_MIB * MIB
/** More remote-side removals than this in one run is a broken listing, not a cleanup. */
export const MAX_REMOVALS = 25
/** More conflict copies than this in one run is a broken sync, not edits; the rest are held. */
export const MAX_CONFLICTS = 25

export const is_remote = path => path.startsWith('can://')

/**
 * What one sync run did, one list of names per outcome. `sessions` and
 * `replay` are keyed by name, and `listing` records how the remote set was
 * read.
 * @typedef {object} SyncReport
 * @property {string[]} too_big
 * @property {string[]} pushed
 * @property {string[]} pulled
 * @property {string[]} deferred
 * @property {string[]} deleted
 * @property {string[]} moved deletes sent because the bytes live on at a new path
 * @property {string[]} held
 * @property {string[]} removed
 * @property {string[]} adopted
 * @property {string[]} replayed
 * @property {string[]} merged
 * @property {string[]} kept_both
 * @property {string[]} unchanged
 * @property {string[]} conflicts
 * @property {Record<string, object>} sessions
 * @property {Record<string, object>} replay
 * @property {string} [listing]
 * @property {number} [mass_removal]
 * @property {boolean} [mass_conflict]
 * @property {boolean} [dry_run] nothing was written, here or remotely
 */

/** The report with every list in name order. */
const sorted = report => {
  for (const list of Object.values(report)) if (Array.isArray(list)) list.sort()
  return report
}

/** An empty sync report, one list per outcome. */
const empty_report = () => ({
  too_big: [],
  pushed: [],
  pulled: [],
  deferred: [],
  deleted: [],
  moved: [],
  held: [],
  removed: [],
  adopted: [],
  replayed: [],
  merged: [],
  kept_both: [],
  unchanged: [],
  conflicts: [],
  sessions: {},
  replay: {}
})

/**
 * Work out what moved: the local files, the remote versions, and the union of
 * names worth looking at. The remote side is one full walk.
 */
const plan_sync = async ({
  api,
  exclude,
  folder,
  local,
  manifest,
  only,
  pull_only,
  remote_files,
  report,
  saved,
  starter
}) => {
  const selected = only && new Set(only)
  const locals = new Map()
  for (const file of await walk(local, (path, is_dir) =>
    exclude(relative(local, path).split(sep).join('/'), is_dir)
  ).catch(() => []))
    locals.set(relative(local, file).split(sep).join('/'), file)
  const remotes =
    remote_files ??
    (await api.walk(folder).catch(error => {
      if (error.status === HTTP.NOT_FOUND && !Object.keys(manifest).length)
        return {}
      throw error
    }))
  report.listing = remote_files ? 'given' : 'walk'
  const stock = await starter_base(api, folder, starter)
  const managed = new Set(
    [
      ...Object.entries(stock?.latest.files ?? {}),
      ...Object.entries(stock?.previous?.files ?? {})
    ]
      .filter(([, value]) => !value.startsWith('link:'))
      .map(([name]) => name)
  )
  const names = new Set(
    [
      ...locals.keys(),
      ...Object.keys(remotes),
      ...Object.keys(manifest),
      ...managed
    ].filter(
      name =>
        !skipped(name) &&
        !exclude(name, false) &&
        (!selected || selected.has(name))
    )
  )
  return { locals, managed, names, remotes, selected, stock }
}

/**
 * After a clean sync, write the starter record both locally and remotely.
 * Never runs while a conflict, a held file, or an oversized file remains.
 */
const settle_starter = async ({
  agree,
  api,
  conditional,
  folder,
  local,
  pull_only,
  remotes,
  report,
  stock
}) => {
  if (
    !stock ||
    report.conflicts.length ||
    report.held.length ||
    report.too_big.length
  )
    return
  const current =
    stock.outdated || stock.previous?.version === stock.latest.version
      ? stock.previous
      : stock.latest
  const bytes = Buffer.from(`${JSON.stringify(current, null, 2)}\n`)
  await safe_target(local, STARTER_FILE)
  let version = remotes[STARTER_FILE]
  if (!pull_only && !stock.previous_bytes?.equals(bytes))
    try {
      version = await api.put(
        `${folder}${STARTER_FILE}`,
        bytes,
        conditional(version ? { version } : null)
      )
    } catch (error) {
      if (error.status !== HTTP.PRECONDITION_FAILED) throw error
      report.conflicts.push(STARTER_FILE)
    }
  if (report.conflicts.length) return
  await mkdir(join(local, '.pi'), { recursive: true })
  await write_file(join(local, STARTER_FILE), bytes)
  if (!pull_only) agree(STARTER_FILE, bytes, version)
}

/**
 * Read the per-file agreement for one folder with one server. Records are keyed
 * by server, so local and production never share an agreement. A record from
 * before that (no `server`) is adopted once by the first server to read it,
 * then removed, so a second server starts from nothing instead of trusting it.
 */
const read_sync_record = async ({ state, server, record_key, pull_only }) => {
  const at = key => join(state, 'sync', `${sha(key).slice(0, KEY_LENGTH)}.json`)
  const record_path = at(`${server}\n${record_key}`)
  if (pull_only) return { record_path, legacy_path: null, saved: {} }
  const read = async path =>
    JSON.parse(await read_file(path, 'utf8').catch(() => 'null'))
  const current = await read(record_path)
  if (current) return { record_path, legacy_path: null, saved: current }
  const legacy_path = at(record_key)
  const legacy = await read(legacy_path)
  if (legacy && !legacy.server)
    return { record_path, legacy_path, saved: legacy }
  return { record_path, legacy_path: null, saved: {} }
}

/** Save the per-file agreement and when this sync ran. */
const save_sync_record = async ({
  baseline,
  deferred,
  legacy_path,
  manifest,
  pair,
  pull_only,
  record_path
}) => {
  if (pull_only && !baseline) return
  await mkdir(dirname(record_path), { recursive: true })
  const synced_at = new Date().toISOString()
  await write_file(
    record_path,
    `${JSON.stringify({ ...pair, files: manifest, deferred, synced_at }, null, 2)}\n`
  )
  if (legacy_path) await rm(legacy_path, { force: true })
}

/**
 * Build the per-name transfer decisions for one sync run. Every helper closes
 * over the run: the remote folder, the local walk, the report, and the log.
 */
/** One transfer phase for one name. Every path reports and returns. */
const pull_only_transfer = async (
  run,
  { bytes, local_sha, name, remote_version }
) => {
  const { agree, fetch_remote, local, pull, report } = run
  await safe_target(local, name)
  if (!remote_version) return report.unchanged.push(name)
  const theirs = await fetch_remote(name)
  if (!theirs) return report.conflicts.push(name)
  if (bytes && (remote_version === local_sha || theirs.bytes.equals(bytes))) {
    agree(name, bytes, remote_version)
    return report.adopted.push(name)
  }
  await pull(name, theirs)
  return report.pulled.push(name)
}

/** One transfer phase for one name. Every path reports and returns. */
const both_unchanged = async (run, { base, bytes, local_sha, name }) => {
  const { agree, api, can_defer, conditional, deferred, folder, report } = run
  if (deferred[name] && bytes) {
    if (
      local_sha === deferred[name] &&
      (await can_defer(name, base, bytes, true))
    )
      return report.deferred.push(name)
    agree(
      name,
      bytes,
      await api.put(`${folder}${name}`, bytes, conditional(base))
    )
    return report.pushed.push(name)
  }
  return report.unchanged.push(name)
}

/** One transfer phase for one name. Every path reports and returns. */
const local_moved_only = async (run, { base, bytes, local_sha, name }) => {
  const {
    agree,
    api,
    call,
    can_defer,
    conditional,
    deferred,
    deletes,
    expect,
    file_of,
    folder,
    forget,
    log,
    report
  } = run
  if (
    deferred[name] &&
    bytes &&
    local_sha === deferred[name] &&
    (await can_defer(name, base, bytes, true))
  )
    return report.deferred.push(name)
  if (!bytes) {
    const moved = await run.moved_away(base)
    if (deletes !== 'all' && !moved && !log.explained(file_of(name), null))
      return report.held.push(name)
    if (moved) report.moved.push(name)
    await expect(
      await call('DELETE', `${folder}${name}`, {
        headers: conditional(base)
      }),
      `rm ${name}`,
      [HTTP.NO_CONTENT]
    )
    forget(name)
    return report.deleted.push(name)
  }
  if (await can_defer(name, base, bytes)) {
    deferred[name] = local_sha
    return report.deferred.push(name)
  }
  agree(
    name,
    bytes,
    await api.put(`${folder}${name}`, bytes, conditional(base))
  )
  return report.pushed.push(name)
}

/** One transfer phase for one name. Every path reports and returns. */
const remote_moved_only = async (
  run,
  { base, bytes, in_sessions, local_sha, mass_removal, name, remote_version }
) => {
  const {
    agree,
    api,
    conditional,
    deferred,
    fetch_remote,
    folder,
    forget,
    local,
    locals,
    pull,
    remotes,
    report,
    trash
  } = run
  if (deferred[name] && local_sha !== (base?.local ?? base?.version)) {
    if (!bytes) return report.held.push(name)
    if (!remote_version) {
      agree(
        name,
        bytes,
        await api.put(`${folder}${name}`, bytes, conditional(null))
      )
      return report.pushed.push(name)
    }
    if (remote_version === local_sha) {
      agree(name, bytes, remote_version)
      return report.adopted.push(name)
    }
    const theirs = await fetch_remote(name)
    if (!theirs) return report.conflicts.push(name)
    if (!run.conflict_allowed()) return report.held.push(name)
    const copy = conflict_name(
      name,
      taken => locals.has(taken) || taken in remotes
    )
    await run.fx.write_file(join(local, copy), theirs.bytes)
    agree(
      copy,
      theirs.bytes,
      await api.put(`${folder}${copy}`, theirs.bytes, conditional(null))
    )
    agree(
      name,
      bytes,
      await api.put(`${folder}${name}`, bytes, conditional(theirs))
    )
    return report.kept_both.push(name)
  }
  if (!remote_version) {
    if (in_sessions(name)) {
      agree(
        name,
        bytes,
        await api.put(`${folder}${name}`, bytes, conditional(null))
      )
      return report.pushed.push(name)
    }
    if (mass_removal) return report.held.push(name)
    await run.fx.to_trash(join(local, name), trash)
    forget(name)
    return report.removed.push(name)
  }
  const theirs = await fetch_remote(name)
  if (!theirs) return report.conflicts.push(name)
  await pull(name, theirs)
  return report.pulled.push(name)
}

/** One transfer phase for one name. Every path reports and returns. */
const both_moved = async (
  run,
  name,
  { base, bytes, file, local_sha, remote_version }
) => {
  const {
    agree,
    api,
    conditional,
    fetch_remote,
    file_of,
    folder,
    forget,
    local,
    locals,
    log,
    pull,
    remotes,
    report
  } = run
  if (bytes && remote_version === local_sha) {
    agree(name, bytes, remote_version)
    return report.adopted.push(name)
  }
  const theirs = remote_version ? await fetch_remote(name) : null
  if (!bytes && !theirs) return void forget(name)
  if (!bytes) {
    await pull(name, theirs)
    return report.pulled.push(name)
  }
  if (!theirs) {
    agree(
      name,
      bytes,
      await api.put(`${folder}${name}`, bytes, conditional(null))
    )
    return report.pushed.push(name)
  }
  if (theirs.version === local_sha || theirs.bytes.equals(bytes)) {
    agree(name, bytes, theirs.version)
    return report.adopted.push(name)
  }
  if (base?.version && theirs.version === base.version) {
    agree(
      name,
      bytes,
      await api.put(`${folder}${name}`, bytes, conditional(theirs))
    )
    return report.pushed.push(name)
  }
  const rows =
    base?.at && replayable(log.since(file_of(name), base.at), run.plain(bytes))
  const replayed =
    rows && apply(theirs.bytes.toString('utf8'), await load_calls(rows))
  if (typeof replayed === 'string') {
    const merged = Buffer.from(replayed)
    await run.fx.write_file(join(local, name), merged)
    agree(
      name,
      merged,
      await api.put(`${folder}${name}`, merged, conditional(theirs))
    )
    return report.replayed.push(name)
  }
  const session = merge_session(name, bytes, theirs.bytes)
  if (session) {
    if (!(await read_file(file)).equals(bytes))
      return report.conflicts.push(name)
    if (!session.equals(bytes)) await run.fx.write_file(file, session)
    agree(
      name,
      session,
      await api.put(`${folder}${name}`, session, conditional(theirs))
    )
    return report.merged.push(name)
  }
  const ours =
    log.explained(file_of(name), run.plain(bytes)) && log.last(file_of(name))
  if (ours) report.sessions[name] = { session: ours.session, turn: ours.turn }
  if (!run.conflict_allowed()) return report.held.push(name)
  const copy = conflict_name(
    name,
    taken => locals.has(taken) || taken in remotes
  )
  locals.set(copy, join(local, copy))
  await run.fx.write_file(join(local, copy), theirs.bytes)
  agree(
    copy,
    theirs.bytes,
    await api.put(`${folder}${copy}`, theirs.bytes, conditional(null))
  )
  agree(
    name,
    bytes,
    await api.put(`${folder}${name}`, bytes, conditional(theirs))
  )
  report.kept_both.push(name)
}

/** Decide one name: read it, compare both sides, and hand off to a phase. */
const transfer_one = async (run, name) => {
  const {
    in_sessions,
    locals,
    managed,
    manifest,
    mass_removal,
    max_bytes,
    pull_only,
    remotes,
    report,
    sha,
    stock,
    update_starter
  } = run
  if (stock && name === STARTER_FILE) return
  const base = manifest[name]
  const file = locals.get(name)
  const bytes = file ? await read_file(file) : null
  if (bytes && bytes.length > max_bytes) return report.too_big.push(name)
  const local_sha = bytes ? sha(bytes) : null
  const remote_version = remotes[name] ?? null
  const local_moved = local_sha !== (base?.local ?? base?.version ?? null)
  const remote_moved = remote_version !== (base?.version ?? null)

  try {
    const updating_starter =
      stock &&
      managed.has(name) &&
      !stock.pending.has(name) &&
      (pull_only || stock.previous?.version !== stock.latest.version)
    if (
      updating_starter &&
      (await update_starter(run, name, { bytes, remote_version }))
    )
      return
    if (pull_only)
      return await pull_only_transfer(run, {
        bytes,
        local_sha,
        name,
        remote_version
      })
    if (!local_moved && !remote_moved)
      return await both_unchanged(run, { base, bytes, local_sha, name })
    if (local_moved && !remote_moved)
      return await local_moved_only(run, { base, bytes, local_sha, name })
    if (!local_moved && remote_moved)
      return await remote_moved_only(run, {
        base,
        bytes,
        in_sessions,
        local_sha,
        mass_removal,
        name,
        remote_version
      })
    return await both_moved(run, name, {
      base,
      bytes,
      file,
      local_sha,
      remote_version
    })
  } catch (error) {
    if (error.status !== HTTP.PRECONDITION_FAILED) throw error
    report.conflicts.push(name)
  }
}

/** A managed starter file moved on. True when this name is done. */
const update_starter = async (run, name, { bytes, remote_version }) => {
  const {
    agree,
    api,
    call,
    conditional,
    deletes,
    expect,
    fetch_remote,
    file_of,
    folder,
    forget,
    local,
    log,
    max_bytes,
    pull,
    pull_only,
    report,
    stock,
    trash
  } = run
  const theirs = remote_version ? await fetch_remote(name) : null
  const choice = starter_choice(stock, name, bytes, theirs?.bytes ?? null)
  if (
    choice === 'keep-local' &&
    !pull_only &&
    (deletes === 'all' || log.explained(file_of(name), null))
  ) {
    if (theirs)
      await expect(
        await call('DELETE', `${folder}${name}`, {
          headers: conditional(theirs)
        }),
        `rm ${name}`,
        [HTTP.NO_CONTENT]
      )
    forget(name)
    return report.deleted.push(name)
  }
  if (choice === 'keep-local' || (choice === 'personal' && pull_only))
    return report.held.push(name)
  if (choice === 'remote') {
    await pull(name, theirs)
    return report.pulled.push(name)
  }
  if (choice === 'remove' || choice === 'remove-local') {
    if (choice === 'remove' && theirs && !pull_only) {
      await expect(
        await call('DELETE', `${folder}${name}`, {
          headers: conditional(theirs)
        }),
        `rm ${name}`,
        [HTTP.NO_CONTENT]
      )
      report.deleted.push(name)
    }
    if (bytes) {
      await safe_target(local, name)
      await run.fx.to_trash(join(local, name), trash)
      report.removed.push(name)
    }
    forget(name)
    return true
  }
  if (choice === 'latest') {
    const updated = await starter_bytes(stock, name)
    if (updated.length > max_bytes) return report.too_big.push(name)
    await safe_target(local, name)
    await run.fx.mkdir(dirname(join(local, name)), { recursive: true })
    if (!bytes?.equals(updated))
      await run.fx.write_file(join(local, name), updated)
    if (!bytes)
      await chmod(
        join(local, name),
        (await stat(join(stock.directory, name))).mode & MODE_BITS
      )
    if (pull_only) {
      if (theirs?.bytes.equals(updated)) agree(name, updated, theirs.version)
      return report.pulled.push(name)
    }
    if (theirs?.bytes.equals(updated)) {
      agree(name, updated, theirs.version)
      return report.adopted.push(name)
    }
    agree(
      name,
      updated,
      await api.put(`${folder}${name}`, updated, conditional(theirs))
    )
    return report.pushed.push(name)
  }
  return false
}

/**
 * `api` whose puts carry the local file's birth time as `x-meta-created`;
 * the server keeps the earliest date anyone sent.
 */
const dated_api = (api, folder, locals) => ({
  ...api,
  async put(path, bytes, headers = {}) {
    const file = path.startsWith(folder)
      ? locals.get(path.slice(folder.length))
      : undefined
    const created = file ? await born(file) : null
    return api.put(path, bytes, {
      ...headers,
      ...(created && { 'x-meta-created': created })
    })
  }
})

/** Local writes a transfer may make; a dry run swaps in no-ops. */
const real_fx = { write_file, to_trash: (...a) => to_trash(...a), mkdir }
const nothing = () => Promise.resolve()
const dry_fx = { write_file: nothing, to_trash: nothing, mkdir: nothing }

/**
 * sy16: the remote side of a dry run. Reads pass through; a PUT returns the
 * version it would have made, a DELETE succeeds, and a guard that the listed
 * remote version would fail is reported as a 412, as the server would.
 */
const dry_remote = ({ api, call, folder, remotes, ver = sha }) => {
  const current = path =>
    path.startsWith(folder) ? remotes[path.slice(folder.length)] : undefined
  const guard = (path, headers = {}) => {
    const now = current(path)
    const match = headers['if-match']?.replace(/"/g, '')
    if (match && now && match !== now)
      throw new SyncError(HTTP.PRECONDITION_FAILED, `put ${path}`)
    if (headers['if-none-match'] === '*' && now)
      throw new SyncError(HTTP.PRECONDITION_FAILED, `put ${path}`)
  }
  return {
    api: {
      ...api,
      put: (path, bytes, headers = {}) =>
        new Promise(resolve => {
          if (path.startsWith(folder)) guard(path, headers)
          resolve(ver(Buffer.from(bytes)))
        }),
      rm: nothing
    },
    call: (method, path, options) =>
      method === 'GET' || method === 'HEAD'
        ? call(method, path, options)
        : Promise.resolve(new Response(null, { status: HTTP.NO_CONTENT }))
  }
}

const make_transfer = ({
  api: plain_api,
  call,
  defer_edits,
  dry_run = false,
  deferred,
  deletes,
  expect,
  folder,
  in_sessions,
  local,
  locals,
  log,
  managed,
  manifest,
  mass_removal,
  max_bytes,
  pair,
  pull_only,
  remotes,
  report,
  saved,
  session_folder,
  sessions_remote,
  sha,
  plain = sha,
  stock,
  trash
}) => {
  const api = dated_api(plain_api, folder, locals)
  const file_of = name => join(pair.local, ...name.split('/'))
  const read_replay = (name, base, bytes) => {
    if (!session_folder || !base?.at || !bytes || !base.version) return null
    const rows = replayable(log.since(file_of(name), base.at), plain(bytes))
    if (
      !rows?.length ||
      rows.some(
        row =>
          !row.session.startsWith(session_folder + sep) ||
          !is_session_file(row.session)
      )
    )
      return null
    return rows
  }
  const agree = (name, bytes, version) => {
    delete deferred[name]
    const ours = bytes ? sha(Buffer.from(bytes)) : version
    manifest[name] = {
      version,
      at: new Date().toISOString(),
      ...(ours !== version && { local: ours })
    }
  }
  /**
   * Versions of the files new to this folder since the last agreement, read
   * once and only when a delete needs them. A file missing at its old path
   * whose version lives on at a new one was moved, so its delete loses nothing.
   */
  /** @type {Promise<Set<string>> | null} */
  let arrived = null
  const moved_away = async base => {
    if (!base?.version) return false
    arrived ??= Promise.all(
      [...locals]
        .filter(([name]) => !manifest[name])
        .map(async ([, path]) => sha(await read_file(path).catch(() => '')))
    ).then(versions => new Set(versions))
    return (await arrived).has(base.local ?? base.version)
  }
  const forget = name => {
    delete deferred[name]
    delete manifest[name]
  }
  const can_defer = async (name, base, bytes, existing = false) => {
    if (!defer_edits || (deferred[name] && !existing)) return false
    const rows = read_replay(name, base, bytes)
    if (!rows) return false
    const calls = await load_calls(rows)
    const original = await fetch_remote(name)
    if (
      !original ||
      original.version !== base.version ||
      sha(original.bytes) !== base.version
    )
      return false
    for (const session of new Set(rows.map(row => row.session))) {
      const session_name = relative(session_folder, session)
        .split(sep)
        .join('/')
      const saved_session = await expect(
        await call('GET', `${sessions_remote}${session_name}`),
        `saved session ${session_name}`,
        [HTTP.OK, HTTP.NOT_FOUND]
      )
      if (
        saved_session.status === HTTP.NOT_FOUND ||
        sha(Buffer.from(await saved_session.arrayBuffer())) !==
          sha(await read_file(session))
      )
        return false
    }
    const replayed = apply(original.bytes.toString('utf8'), calls)
    if (replayed === null || !Buffer.from(replayed).equals(bytes)) return false
    report.replay[name] = {
      base_sha: base.version,
      target_sha: sha(bytes),
      calls: rows.map(row => ({
        session: relative(session_folder, row.session).split(sep).join('/'),
        tool_call: row.tool_call
      }))
    }
    return true
  }
  const fetch_remote = async name => {
    const response = await expect(
      await call('GET', `${folder}${name}`),
      `get ${name}`,
      [HTTP.OK, HTTP.NOT_FOUND]
    )
    if (response.status === HTTP.NOT_FOUND) return null
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      version: version_of(response),
      created: response.headers.get('x-meta-created')
    }
  }
  const pull = async (name, theirs) => {
    await safe_target(local, name)
    const target = join(local, name)
    if (dry_run) return agree(name, theirs.bytes, theirs.version)
    await mkdir(dirname(target), { recursive: true })
    await write_file(target, theirs.bytes)
    if (theirs.created) await set_born(target, theirs.created)
    agree(name, theirs.bytes, theirs.version)
  }
  const conditional = base =>
    base ? { 'if-match': `"${base.version}"` } : { 'if-none-match': '*' }

  /**
   * A managed starter file moved on. Returns true when this name is done,
   * false when the caller should keep deciding.
   */

  let conflicts_left = MAX_CONFLICTS
  /** One more conflict copy, unless this run already wrote too many. */
  const conflict_allowed = () => {
    if (conflicts_left > 0) return Boolean(conflicts_left--)
    report.mass_conflict = true
    return false
  }

  /** Everything the transfer phases read, gathered once. */
  const run = {
    fx: dry_run ? dry_fx : real_fx,
    conflict_allowed,
    moved_away,
    agree,
    api,
    call,
    can_defer,
    conditional,
    deferred,
    deletes,
    expect,
    fetch_remote,
    file_of,
    folder,
    forget,
    in_sessions,
    local,
    locals,
    log,
    managed,
    manifest,
    mass_removal,
    max_bytes,
    pull,
    pull_only,
    remotes,
    report,
    sha,
    plain,
    stock,
    trash,
    update_starter
  }

  return { agree, conditional, one: name => transfer_one(run, name) }
}

/** The plain read and write calls, without the sync machinery. */
const read_api = ({ call, expect, key }) => {
  const trash_root = org =>
    org ? `can://trash/orgs/${org}/` : `can://trash/${key('can://~/')}`
  const api = {
    async ls(path) {
      const folder = path.endsWith('/') ? path : `${path}/`
      const response = await expect(await call('GET', folder), `ls ${path}`)
      const { files, folders } = await response.json()
      return [...folders.map(name => `${name}/`), ...files]
    },

    async cat(path) {
      const response = await expect(await call('GET', path), `cat ${path}`)
      return Buffer.from(await response.arrayBuffer())
    },

    async put(path, bytes, headers = {}) {
      const upload = await packed_upload(Buffer.from(bytes))
      const response = await expect(
        await call('PUT', path, {
          body: upload.body,
          headers: { ...headers, ...upload.headers }
        }),
        `put ${path}`
      )
      return response.headers.get('etag')?.replace(/"/g, '')
    },

    /** A remote file's version, or null when it is missing. Needs no folder listing. */
    async version(path) {
      const response = await expect(
        await call('GET', path),
        `version ${path}`,
        [HTTP.OK, HTTP.NOT_FOUND]
      )
      if (response.status === HTTP.NOT_FOUND) return null
      await response.arrayBuffer()
      return response.headers.get('etag')?.replace(/"/g, '') ?? null
    },

    async rm(path) {
      await expect(await call('DELETE', path), `rm ${path}`, [HTTP.NO_CONTENT])
    },

    /**
     * sy15: what sync kept from deletes, `<day>/<time>/<path>` to version.
     * Yours by default; an org's (`+name`) for its founder.
     */
    trash(org = null) {
      return api.walk(trash_root(org))
    },

    /** Put one trashed file back where it was; refuses if that path is taken. */
    async restore(name, org = null) {
      const from = `${trash_root(org)}${name}`
      const to = trashed_from(key(from))
      if (!to) throw new Error(`not a trashed file: ${name}`)
      await api.put(`can://${to}`, await api.cat(from), {
        'if-none-match': '*'
      })
      await api.rm(from)
      return `can://${to}`
    },

    /** Local file to remote, or remote file to local. Folders take the basename. */
    async cp(from, to) {
      if (is_remote(from) === is_remote(to))
        throw new Error('cp copies between local and can://')
      if (!is_remote(from)) {
        const target = to.endsWith('/') ? `${to}${basename(from)}` : to
        await api.put(target, await read_file(from))
        return target
      }
      let target = to
      if (to.endsWith(sep) || to.endsWith('/') || (await is_dir(to)))
        target = join(to, basename(key(from)))
      await mkdir(dirname(target), { recursive: true })
      await write_file(target, await api.cat(from))
      return target
    },

    /** Every remote file below a folder, name to version. */
    async walk(path) {
      const folder = path.endsWith('/') ? path : `${path}/`
      return (
        await expect(
          await call('GET', folder, { query: 'deep' }),
          `walk ${path}`
        )
      ).json()
    },

    /** h7: an hour-long read token for one shared GitHub repo; harness passes only. */
    async git_token(repo) {
      const response = await call('POST', 'v1/git-token', {
        body: JSON.stringify({ repo }),
        headers: { 'content-type': 'application/json' }
      })
      return (await expect(response, `git token ${repo}`)).json()
    },

    /** Every remote file below a folder, name to { version, size, updated }. */
    async walk_meta(path) {
      const folder = path.endsWith('/') ? path : `${path}/`
      return (
        await expect(
          await call('GET', folder, { query: 'deep=meta' }),
          `walk ${path}`
        )
      ).json()
    }
  }
  return api
}

/** A `can://` path as a store key; `~` is the signed-in person. */
const key_for = phone => path => {
  let rest = path.replace(/^can:\/\//, '')
  if (rest === '~' || rest.startsWith('~/')) {
    if (!phone) throw new Error('can://~ needs a token with a phone number')
    rest = `people/${phone}${rest.slice(1)}`
  }
  return rest
}

/**
 * One request. A 401 asks `token({ refresh: true })`; when that gives a new token,
 * sends the same request once more, so a write made as a token expires
 * still lands.
 * @returns {(method: string, path: string, options?: { body?: BodyInit, headers?: Record<string, string>, query?: string }) => Promise<Response>}
 */
const caller =
  ({ url, token, fetcher, key }) =>
  async (method, path, { body, headers = {}, query = '' } = {}) => {
    const encoded = key(path).split('/').map(encodeURIComponent).join('/')
    const send = current =>
      fetcher(`${url}/${encoded}${query && `?${query}`}`, {
        method,
        body,
        headers: {
          ...(current && { authorization: `Bearer ${current}` }),
          ...headers
        }
      })
    const first = typeof token === 'function' ? await token() : token
    const response = await send(first)
    if (response.status !== HTTP.UNAUTHORIZED || typeof token !== 'function')
      return response
    const fresh = await token({ refresh: true })
    if (!fresh || fresh === first) return response
    await response.arrayBuffer().catch(() => {})
    return send(fresh)
  }

/** Runs `work` on each item, at most `concurrency` at a time. */
const in_pool = async (all, concurrency, work) => {
  let next = 0
  const worker = async () => {
    while (next < all.length) await work(all[next++])
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, all.length) }, worker)
  )
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {string | null | ((options?: { refresh?: boolean }) => string | null | Promise<string | null>)} [options.token] a function is asked again with `refresh` after a 401
 * @param {typeof fetch} [options.fetcher]
 * @param {string | null} [options.phone]
 * @param {string} [options.state]
 * @param {string} [options.trash]
 */
export const client = ({
  url,
  token,
  fetcher = fetch,
  phone = phone_of(token),
  state: default_state,
  trash: default_trash
}) => {
  const key = key_for(phone)
  const call = zipped_call(caller({ url, token, fetcher, key }), key, sha)
  const server = String(url).replace(/\/+$/, '')

  const expect = (response, what, ok = [HTTP.OK]) => {
    if (!ok.includes(response.status))
      throw new SyncError(response.status, what)
    return response
  }

  const api = {
    me: phone,
    key,
    ...read_api({ call, expect, key }),

    /**
     * Two-way: whichever side moved from the base wins; both moving is a
     * conflict.
     * @param {string} local
     * @param {string} remote
     * @param {object} [options]
     * @param {number} [options.concurrency]
     * @param {string} [options.state]
     * @param {'all' | 'explained'} [options.deletes]
     * @param {string} [options.trash]
     * @param {boolean} [options.defer_edits]
     * @param {string} [options.sessions]
     * @param {string} [options.sessions_remote]
     * @param {string[] | null} [options.only]
     * @param {(path: string, is_dir: boolean) => boolean} [options.exclude]
     * @param {number} [options.max_bytes]
     * @param {boolean} [options.pull_only]
     * @param {boolean} [options.baseline]
     * @param {Record<string, string> | null} [options.remote_files]
     * @param {object | null} [options.starter]
     * @param {boolean} [options.dry_run] sy16: decide everything, write nothing
     */
    async sync(
      local,
      remote,
      {
        concurrency = CONCURRENCY,
        state = default_state ?? state_dir(),
        deletes = 'explained',
        trash = default_trash ?? trash_dir(state),
        defer_edits = false,
        sessions,
        sessions_remote = 'can://~/.pi/agent/sessions/',
        only = null,
        exclude = () => false,
        max_bytes = MAX_BYTES,
        pull_only = false,
        baseline = false,
        remote_files = null,
        starter = null,
        dry_run = false
      } = {}
    ) {
      const folder = remote.endsWith('/') ? remote : `${remote}/`
      const pair = { local: resolve(local), remote: key(folder) }
      const selected = only && new Set(only)
      const record_key = `${pair.local}\n${pair.remote}${selected ? `\n${[...selected].sort().join('\n')}` : ''}`
      const { record_path, legacy_path, saved } = await read_sync_record({
        state,
        server,
        record_key,
        pull_only
      })
      const manifest = saved.files ?? {}
      const deferred = saved.deferred ?? {}
      const report = empty_report()

      const log = edit_log(edit_log_path(state))
      const session_folder = sessions && resolve(sessions)
      const { locals, managed, names, remotes, stock } = await plan_sync({
        api,
        exclude,
        folder,
        local,
        manifest,
        only,
        pull_only,
        remote_files,
        report,
        saved,
        starter
      })

      const in_sessions = name =>
        Boolean(session_folder) &&
        is_session_file(join(pair.local, ...name.split('/'))) &&
        join(pair.local, ...name.split('/')).startsWith(session_folder + sep)
      const vanished = [...names].filter(
        name =>
          manifest[name] &&
          !remotes[name] &&
          locals.has(name) &&
          !in_sessions(name)
      ).length
      const mass_removal = vanished > MAX_REMOVALS
      if (mass_removal) report.mass_removal = vanished
      if (dry_run) report.dry_run = true
      // sy18: harness versions hash the zip; the edit log keeps plain hashes
      const ver = is_zipped(key(folder)) ? bytes => sha(zip(bytes)) : sha
      const side = dry_run
        ? dry_remote({ api, call, folder, remotes, ver })
        : { api, call }
      const { one, agree, conditional } = make_transfer({
        api: side.api,
        call: side.call,
        defer_edits: defer_edits && !dry_run,
        dry_run,
        deferred,
        deletes,
        expect,
        folder,
        in_sessions,
        local,
        locals,
        log,
        managed,
        manifest,
        mass_removal,
        max_bytes,
        pair,
        pull_only,
        remotes,
        report,
        saved,
        session_folder,
        sessions_remote,
        sha: ver,
        plain: sha,
        stock,
        trash
      })
      await in_pool([...names].sort(), concurrency, one)
      log.close()
      if (dry_run) return sorted(report)
      await settle_starter({
        agree,
        api,
        conditional,
        folder,
        local,
        pull_only,
        remotes,
        report,
        stock
      })
      await save_sync_record({
        baseline,
        deferred,
        legacy_path,
        manifest,
        pair: { ...pair, server },
        pull_only,
        record_path
      })
      return sorted(report)
    }
  }
  return api
}

/** macOS keeps a Trash; elsewhere removed files wait in harness state. */
export const trash_dir = state =>
  process.platform === 'darwin'
    ? join(homedir(), '.Trash')
    : join(state, 'trash')

/** Move a file aside, never destroy it: `note.md` lands as `note 2026-09-27T….md`. */
export const to_trash = async (path, trash) => {
  const stamp = new Date().toISOString().replace(/:/g, '-')
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  const target = join(
    trash,
    dot > 0
      ? `${name.slice(0, dot)} ${stamp}${name.slice(dot)}`
      : `${name} ${stamp}`
  )
  await mkdir(trash, { recursive: true })
  try {
    await rename(path, target)
  } catch (error) {
    if (error.code === 'ENOENT') return
    if (error.code !== 'EXDEV') throw error
    await copy_file(path, target)
    await rm(path, { force: true })
  }
}

/** `note.md` becomes `note.conflict.md`, then `note.conflict-2.md`, until one is free. */
export const conflict_name = (name, taken) => {
  const slash = name.lastIndexOf('/') + 1
  const dot = name.indexOf('.', slash + 1)
  const [stem, ext] =
    dot === -1 ? [name, ''] : [name.slice(0, dot), name.slice(dot)]
  for (let n = 1; ; n++) {
    const candidate = `${stem}.conflict${n === 1 ? '' : `-${n}`}${ext}`
    if (!taken(candidate)) return candidate
  }
}

/** Refuse traversal and links before a remote file can replace local bytes. */
const safe_target = async (root, name) => {
  const parts = name.split('/')
  if (parts.some(unsafe_part)) throw new Error(`unsafe sync path: ${name}`)
  let target = resolve(root)
  for (const part of ['', ...parts]) {
    if (part) target = join(target, part)
    const info = await lstat(target).catch(error => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    if (info?.isSymbolicLink()) throw new Error(`target is a link: ${target}`)
  }
}

const version_of = response => response.headers.get('etag')?.replace(/"/g, '')

const is_dir = async path =>
  (await stat(path).catch(() => null))?.isDirectory() ?? false

/**
 * Every file below `dir`, in order, skipping the names the sync never sends.
 * @param {string} dir
 * @param {(path: string, is_dir: boolean) => boolean} [exclude]
 */
const walk = async (dir, exclude = () => false) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skipped_name(entry.name)) continue
    const path = join(dir, entry.name)
    if (exclude(path, entry.isDirectory())) continue
    if (entry.isDirectory()) found.push(...(await walk(path, exclude)))
    else if (entry.isFile()) found.push(path)
  }
  return found.sort()
}
