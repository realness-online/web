/**
 * l4: the Mac's `vault/` and `quarantine/` move both ways with the store, and
 * every write is guarded by the version it started from. A record beside the
 * folders holds each file's version at the last agreement: the side that moved
 * from it wins, and both moving keeps both, the other side's copy landing as
 * `x.conflict.ext`. A file the store no longer has goes when the record knows
 * it and this copy still matches the record; a file the record never saw stays
 * and goes back up. A lost record is safe: every file looks new, so identical
 * ones match and the rest keep both.
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
import { version_file } from '#root/src/files/version-file.js'
import { version_sync } from '#root/src/files/version-node.js'
import { orgs_of } from '#root/src/sync/orgs.js'
/* eslint-disable no-await-in-loop -- one file at a time keeps the record and the guards in order */

/** The folders that sync both ways, each at its own path on the Mac and in the store. */
const TWO_WAY = ['vault', 'quarantine']

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
 * One folder both ways.
 * @param {{ root: string, store: any, base: string, folder: string, saved: Record<string, string>, next: Record<string, string>, report: { pushed: string[], pulled: string[], deleted: string[], kept_both: string[], unchanged: string[], too_big: string[], postponed: string[] } }} run
 */
const one_folder = async ({
  root,
  store,
  base,
  folder,
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
    .filter(name => name.split('/').at(-1) !== 'members.html')
    .sort()
  for (const name of names) {
    const key = `${folder}/${name}`
    const file = join(root, folder, name)
    const here = on_mac.includes(name) ? await local_version(file) : null
    const there = remote.get(name) ?? null
    const was = saved[key]
    if (here !== null && here === there) {
      next[key] = here
      report.unchanged.push(key)
      continue
    }
    if (here === null) {
      const bytes = await store.get(`${prefix}${name}`)
      if (!bytes) continue
      await write_local(file, bytes.body)
      next[key] = there
      report.pulled.push(key)
      continue
    }
    if (there === null) {
      if (was !== undefined && was === here) {
        await rm(file, { force: true })
        delete next[key]
        report.deleted.push(key)
        continue
      }
      const version = await push({
        store,
        key: `${prefix}${name}`,
        file,
        there,
        report
      })
      if (version === null) continue
      next[key] = version
      report.pushed.push(key)
      continue
    }
    if (was !== undefined && was === here) {
      const theirs = await store.get(`${prefix}${name}`)
      if (!theirs) continue
      await write_local(file, theirs.body)
      next[key] = there
      report.pulled.push(key)
      continue
    }
    if (was !== undefined && was === there) {
      const version = await push({
        store,
        key: `${prefix}${name}`,
        file,
        there,
        report
      })
      if (version === null) continue
      next[key] = version
      report.pushed.push(key)
      continue
    }
    const theirs = await store.get(`${prefix}${name}`)
    if (!theirs) continue
    await write_local(join(root, folder, conflict_path(name)), theirs.body)
    const version = await push({
      store,
      key: `${prefix}${name}`,
      file,
      there,
      report
    })
    if (version === null) continue
    next[key] = version
    report.kept_both.push(key)
  }
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
 * The Mac's own folders both ways with its lane in the store, then x3: each
 * org folder it is a member of, at `orgs/+name/`. Members pages stay in the
 * store; the founder edits them through sync.
 * @param {{ root: string, store: any, phone: string, record: string }} run
 * @returns {Promise<{ pushed: string[], pulled: string[], deleted: string[], kept_both: string[], unchanged: string[], too_big: string[], postponed: string[] }>}
 */
export const two_way = async ({ root, store, phone, record }) => {
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
  for (const folder of TWO_WAY)
    await one_folder({ root, store, base, folder, saved, next, report })
  for (const name of await orgs_of(store, phone))
    await one_folder({
      root,
      store,
      base: '',
      folder: `orgs/${name}`,
      saved,
      next,
      report
    })
  await save_record(record, next)
  return report
}
