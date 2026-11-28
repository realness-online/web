/**
 * z4, l4: the Mac's `vault/` goes up only, the Mac's copy winning over the
 * cloud's, so no `.conflict` file is ever written. A file the Mac deleted goes
 * from the store when the record knew it; a file the record never saw stays.
 * `quarantine/` and org folders move both ways: others' changes come in there.
 * Every write is guarded by the version it started from.
 *
 * Both ways: the side that moved from the record wins, and both moving keeps
 * both, the cloud copy landing as `x.conflict.ext`. A lost record is safe:
 * every file looks new, so identical ones match and the rest keep both.
 */
import {
  mkdir,
  readFile as read_file,
  rm,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { MAX_BYTES } from '#root/src/files/client.js'
import { local_paths } from '#root/src/files/upload.js'
import { skipped } from '#root/src/files/skip.js'
import { style_local } from '#root/src/files/preview-styles.js'
import { version_file } from '#root/src/files/version-file.js'
import { version_sync } from '#root/src/files/version-node.js'
import { orgs_of } from '#root/src/sync/orgs.js'
/* eslint-disable no-await-in-loop -- one folder at a time; files inside move in lanes */

/** The folders that sync both ways, each at its own path on the Mac and in the store. */
const TWO_WAY = ['vault', 'quarantine']

/** An org's own pages: its member list and its hash page stay in the store. */
const ORG_OWN = new Set(['members.html', 'sync-hash.html'])

/** How many files move at the same time; each write is guarded by its own version. */
const AT_ONCE = 16

/** Where the cloud copy of a name lands on the Mac when both sides moved. */
const conflict_path = name => {
  const dot = name.lastIndexOf('.')
  const slash = name.lastIndexOf('/')
  return dot > slash
    ? `${name.slice(0, dot)}.conflict${name.slice(dot)}`
    : `${name}.conflict`
}

/** What the last run agreed on, per folder path. A lost or broken record is empty. */
const read_record = async path => {
  try {
    return JSON.parse(await read_file(path, 'utf8'))
  } catch {
    return {}
  }
}

/** @param {string} path @param {Record<string, string>} record */
const save_record = async (path, record) => {
  await mkdir(dirname(path), { recursive: true })
  const sorted = Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1))
  )
  await write_file(path, `${JSON.stringify(sorted, null, 2)}\n`)
}

/**
 * @param {string} path a `/`-separated path under the root
 * @returns {Promise<string | null>}
 */
const local_version = path => version_file(path).catch(() => null)

/** @param {string} path @param {Buffer} bytes */
const write_local = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true })
  await write_file(path, bytes)
}

/**
 * One name, the Mac's copy winning: a change on the Mac goes up whatever the
 * store holds, a file the Mac no longer has goes from the store when the
 * record knew it, and a file the record never saw stays. Nothing comes down.
 * @param {{ store: any, prefix: string, key: string, name: string, file: string, on_mac: boolean, here: string | null, there: string | null, was: string | undefined, next: Record<string, string>, report: { pushed: string[], deleted: string[], unchanged: string[], too_big: string[], postponed: string[] } }} run
 */
const mac_wins = async ({
  store,
  prefix,
  key,
  name,
  file,
  on_mac,
  here,
  there,
  was,
  next,
  report
}) => {
  if (!on_mac) {
    if (was === undefined) return
    if (there !== null) {
      try {
        await store.delete(`${prefix}${name}`, { if_version: there })
      } catch (error) {
        if (error.code !== 'conflict') throw error
        report.postponed.push(key)
        return
      }
      report.deleted.push(key)
    }
    delete next[key]
    return
  }
  if (here !== null && here === there) {
    next[key] = here
    report.unchanged.push(key)
    return
  }
  const version = await push({
    store,
    key: `${prefix}${name}`,
    file,
    there,
    report
  })
  if (version === null) return
  next[key] = version
  report.pushed.push(key)
}

/**
 * One folder both ways, or one way when `wins` is `mac`.
 * @param {{ root: string, store: any, base: string, folder: string, shallow?: boolean, wins?: 'mac' | 'both', saved: Record<string, string>, next: Record<string, string>, report: { pushed: string[], pulled: string[], deleted: string[], kept_both: string[], unchanged: string[], too_big: string[], postponed: string[] } }} run
 */
const one_folder = async ({
  root,
  store,
  base,
  folder,
  shallow = false,
  wins = 'both',
  saved,
  next,
  report
}) => {
  const prefix = `${base}${folder}/`
  const listed = await store.walk_meta(prefix).catch(() => ({}))
  const remote = new Map(
    Object.entries(listed).map(([name, info]) => [name, info.version])
  )
  const on_mac = (await local_paths(root, folder)).map(path =>
    path.slice(folder.length + 1)
  )
  const names = [...new Set([...on_mac, ...remote.keys()])]
    .filter(name => !ORG_OWN.has(name.split('/').at(-1) ?? ''))
    .filter(name => !skipped(name))
    .filter(name => !shallow || !name.includes('/'))
    .sort()
  const mine = new Set(on_mac)
  /** @param {string} name */
  const one_name = async name => {
    const key = `${folder}/${name}`
    const file = join(root, folder, name)
    if (mine.has(name)) await style_local(key, file)
    const here = mine.has(name) ? await local_version(file) : null
    const there = remote.get(name) ?? null
    const was = saved[key]
    if (wins === 'mac') {
      await mac_wins({
        store,
        prefix,
        key,
        name,
        file,
        on_mac: mine.has(name),
        here,
        there,
        was,
        next,
        report
      })
      return
    }
    if (here !== null && here === there) {
      next[key] = here
      report.unchanged.push(key)
      return
    }
    if (!mine.has(name) && was !== undefined && was === there) {
      try {
        await store.delete(`${prefix}${name}`, { if_version: there })
      } catch (error) {
        if (error.code !== 'conflict') throw error
        report.postponed.push(key)
        return
      }
      delete next[key]
      report.deleted.push(key)
      return
    }
    if (here === null) {
      const bytes = await store.get(`${prefix}${name}`)
      if (!bytes) return
      await write_local(file, bytes.body)
      next[key] = there
      report.pulled.push(key)
      return
    }
    if (there === null) {
      if (was !== undefined && was === here) {
        await rm(file, { force: true })
        delete next[key]
        report.deleted.push(key)
        return
      }
      const version = await push({
        store,
        key: `${prefix}${name}`,
        file,
        there,
        report
      })
      if (version === null) return
      next[key] = version
      report.pushed.push(key)
      return
    }
    if (was !== undefined && was === here) {
      const theirs = await store.get(`${prefix}${name}`)
      if (!theirs) return
      await write_local(file, theirs.body)
      next[key] = there
      report.pulled.push(key)
      return
    }
    if (was !== undefined && was === there) {
      const version = await push({
        store,
        key: `${prefix}${name}`,
        file,
        there,
        report
      })
      if (version === null) return
      next[key] = version
      report.pushed.push(key)
      return
    }
    const theirs = await store.get(`${prefix}${name}`)
    if (!theirs) return
    await write_local(join(root, folder, conflict_path(name)), theirs.body)
    const version = await push({
      store,
      key: `${prefix}${name}`,
      file,
      there,
      report
    })
    if (version === null) return
    next[key] = version
    report.kept_both.push(key)
  }
  const queue = names.values()
  const lane = async () => {
    for (const name of queue) await one_name(name)
  }
  await Promise.all(Array.from({ length: AT_ONCE }, lane))
}

/**
 * One file up, guarded by the version the store holds.
 * @param {{ store: any, key: string, file: string, there: string | null, report: { too_big: string[], postponed: string[] } }} run
 * @returns {Promise<string | null>} the version written, or null when it did not land
 */
const push = async ({ store, key, file, there, report }) => {
  const bytes = await read_file(file)
  if (bytes.byteLength > MAX_BYTES) {
    report.too_big.push(key)
    return null
  }
  try {
    await store.put(
      key,
      bytes,
      there === null ? { if_absent: true } : { if_version: there }
    )
  } catch (error) {
    if (error.code === 'conflict') {
      report.postponed.push(key)
      return null
    }
    throw error
  }
  return version_sync(bytes)
}

/**
 * The Mac's own folders with its lane in the store, then x3: each org folder it
 * is a member of, at `orgs/+name/`. `vault/` goes up only (z4); `quarantine/`
 * and org folders move both ways. Members pages stay in the store; the founder
 * edits them through sync.
 * With `folders`, only those move: `vault` alone is its top files,
 * `vault/X` is that folder whole, and `orgs/+name/dir` is that org folder's
 * own files. With no `folders`, everything moves, every org whole.
 * @param {{ root: string, store: any, phone: string, record: string, folders?: string[] }} run
 * @returns {Promise<{ pushed: string[], pulled: string[], deleted: string[], kept_both: string[], unchanged: string[], too_big: string[], postponed: string[] }>}
 */
export const two_way = async ({ root, store, phone, record, folders }) => {
  const base = `people/${phone}/`
  const saved = await read_record(record)
  const next = { ...saved }
  const report = {
    pushed: [],
    pulled: [],
    deleted: [],
    kept_both: [],
    unchanged: [],
    too_big: [],
    postponed: []
  }
  const own = folders?.filter(folder => !folder.startsWith('orgs/')) ?? TWO_WAY
  for (const folder of own)
    await one_folder({
      root,
      store,
      base,
      folder,
      shallow: folders !== undefined && folder === 'vault',
      wins: folder === 'vault' || folder.startsWith('vault/') ? 'mac' : 'both',
      saved,
      next,
      report
    })
  const member = await orgs_of(store, phone)
  const org_folders = folders
    ? folders.filter(
        folder =>
          folder.startsWith('orgs/') && member.includes(folder.split('/')[1])
      )
    : member.map(name => `orgs/${name}`)
  for (const folder of org_folders)
    await one_folder({
      root,
      store,
      base: '',
      folder,
      shallow: folders !== undefined,
      saved,
      next,
      report
    })
  await save_record(record, next)
  return report
}
