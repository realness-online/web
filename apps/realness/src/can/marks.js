/**
 * h1: each person's `sync-hash.html` holds a hash per vault folder, a vault
 * top hash, and a quarantine hash. A write marks its folder in memory; a
 * flush, soon after, rehashes marked folders and writes the page guarded by
 * its version, so many writers stay safe with no lock.
 */
/* eslint-disable no-await-in-loop -- one page write at a time keeps retries honest */
import { createHash as create_hash } from 'node:crypto'
import { item_html, read_item, read_items } from '#root/lib/items.js'
import { Conflict } from './contract.js'

export const SYNC_HASH = 'sync-hash.html'
const MARKED = /^people\/(\+[1-9]\d{6,14})\/(vault|quarantine)\/(.+)$/
const TRIES = 5
const WAIT_MS = 2000
/** Flushers of every marked store this process opened. */
const flushing = new Set()

/** Rebuild every person's page: the sync server's daily repair. */
export const rebuild_all = async storage => {
  const { folders } = await storage.list('people/')
  for (const person of folders) await storage.rebuild(person)
}

/** Write every pending mark now; a one-shot tool calls this before it exits. */
export const flush_marks = async () => {
  for (const flush of flushing) await flush()
}

/** The person and folder a key marks, or null. */
export const folder_of = key => {
  const found = key.match(MARKED)
  if (!found) return null
  const [, person, root, rest] = found
  if (root === 'quarantine') return { person, folder: 'quarantine' }
  const slash = rest.indexOf('/')
  return {
    person,
    folder: slash === -1 ? 'vault' : `vault/${rest.slice(0, slash)}`
  }
}

const hash_of = lines =>
  create_hash('sha256').update(lines.sort().join('\n')).digest('hex')

/** The hash of one folder's files, or null when it holds none. */
const folder_hash = async (storage, person, folder) => {
  const prefix = `people/${person}/${folder}/`
  const found = Object.entries(await storage.walk(prefix)).filter(
    ([name]) => folder === 'quarantine' || !name.includes('/')
  )
  if (!found.length) return null
  return hash_of(found.map(([name, version]) => `${name} ${version}`))
}

/** @param {string} html */
export const read_sync_hash = html => {
  const top = read_item(html, 'sync-hash') ?? {}
  return {
    vault: top.vault ?? '',
    quarantine: top.quarantine ?? '',
    folders: Object.fromEntries(
      read_items(html, 'folder').map(({ name, hash }) => [name, hash])
    )
  }
}

/** @param {{ vault: string, quarantine: string, folders: Record<string, string> }} page */
const page_of = ({ quarantine, folders }) => {
  const names = Object.keys(folders).sort()
  const vault = names.length
    ? hash_of(names.map(name => `${name} ${folders[name]}`))
    : ''
  return (
    item_html('sync-hash', { vault, quarantine }) +
    names
      .map(name => item_html('folder', { name, hash: folders[name] }))
      .join('')
  )
}

/** Rehash `folders` of one person into their page; retry when it moved. */
const write_page = async (storage, person, folders) => {
  const key = `people/${person}/${SYNC_HASH}`
  for (let tries = 1; ; tries++) {
    const current = await storage.stat(key)
    const page = current
      ? read_sync_hash((await storage.get(key)).body.toString())
      : { vault: '', quarantine: '', folders: {} }
    for (const folder of folders) {
      const hash = await folder_hash(storage, person, folder)
      if (folder === 'quarantine') page.quarantine = hash ?? ''
      else if (hash) page.folders[folder] = hash
      else delete page.folders[folder]
    }
    const guard = current
      ? { if_version: current.version }
      : { if_absent: true }
    try {
      return await storage.put(key, Buffer.from(page_of(page)), guard)
    } catch (error) {
      if (!(error instanceof Conflict) || tries >= TRIES) throw error
    }
  }
}

/**
 * @template {{ put: Function, delete: Function, compose: Function, walk: Function, get: Function, stat: Function, list: Function }} S
 * @param {S} storage
 * @param {{ wait?: number }} [options]
 */
export const marked = (storage, { wait = WAIT_MS } = {}) => {
  /** @type {Map<string, Set<string>>} */
  const marks = new Map()
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer

  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    const due = [...marks]
    marks.clear()
    for (const [person, folders] of due)
      await write_page(storage, person, folders)
  }

  const note = (person, folder) => {
    const folders = marks.get(person) ?? new Set()
    folders.add(folder)
    marks.set(person, folders)
    timer ??= setTimeout(() => flush().catch(console.error), wait)
    timer.unref?.()
  }

  const mark = key => {
    const found = folder_of(key)
    if (found) note(found.person, found.folder)
  }

  const after = (key, done) => done.then(value => (mark(key), value))

  /** Mark every folder of one person, then flush: the repair for lost marks. */
  const rebuild = async person => {
    const { folders } = await storage.list(`people/${person}/vault/`)
    note(person, 'vault')
    note(person, 'quarantine')
    for (const folder of folders) note(person, `vault/${folder}`)
    await flush()
  }

  flushing.add(flush)
  return {
    ...storage,
    put: (key, body, options) => after(key, storage.put(key, body, options)),
    delete: (key, options) => after(key, storage.delete(key, options)),
    compose: (key, sources, options) =>
      after(key, storage.compose(key, sources, options)),
    flush,
    rebuild
  }
}
