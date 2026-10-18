/**
 * e9: the session log moves between surfaces, and the tail gives the next
 * sequence. Export reads every store of one durable database into a plain
 * object; import writes it into another. Commits order by `commitSeq`, so the
 * highest one present is the tail - nothing else needs to travel.
 *
 *   export_log(db)        -> { version, stores, tail, ids }
 *   import_log(db, log)   -> { written, tail }
 */
import { STORE_NAMES } from './session-stores.js'

/** Which field carries each store's key, because compound keys need both parts. */
const KEY_PATHS = {
  metadata: 'key',
  identities: 'key',
  conversations: 'id',
  entries: 'id',
  tasks: 'id',
  submissions: 'id',
  documents: 'id',
  revisions: ['documentId', 'seq']
}

const key_of = (store, value) => {
  const path = KEY_PATHS[store]
  return Array.isArray(path) ? path.map(part => value[part]) : value[path]
}

const request_of = request =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/** Stores whose keys are supplied rather than carried by the value. */
const OUT_OF_LINE = new Set(['identities', 'metadata'])

const put_row = (store, name, { key, value }) =>
  OUT_OF_LINE.has(name) ? store.put(value, key) : store.put(value)

const read_all = async (db, store) => {
  const transaction = db.transaction(store, 'readonly')
  const object_store = transaction.objectStore(store)
  const rows = await request_of(object_store.getAll())
  const keys = await request_of(object_store.getAllKeys())
  return rows.map((value, i) => ({
    key: object_store.keyPath === null ? keys[i] : key_of(store, value),
    value
  }))
}

/** The highest commit sequence in the log, or 1 when it holds none. */
export const tail_of = entries => {
  let tail = 1
  for (const { value } of entries)
    if (value.commitSeq >= tail) tail = value.commitSeq
  return tail
}

/** The highest id minted or stored across every store. */
export const highest_id_of = stores => {
  let highest = 1
  for (const name of STORE_NAMES) {
    if (name === 'metadata' || name === 'revisions') continue
    for (const { value } of stores[name]) {
      const id = typeof value.id === 'number' ? value.id : 0
      if (id > highest) highest = id
    }
  }
  for (const { value } of stores.revisions) {
    const id = typeof value.documentId === 'number' ? value.documentId : 0
    if (id > highest) highest = id
  }
  return highest
}

/**
 * Read one durable database out as a log.
 * @param {IDBDatabase} db
 */
export const export_log = async db => {
  const read = await Promise.all(
    STORE_NAMES.map(async name => [name, await read_all(db, name)])
  )
  const stores = Object.fromEntries(read)
  const tail = tail_of(stores.entries)
  return { version: 1, stores, tail, ids: highest_id_of(stores) }
}

/**
 * Write a log into an empty durable database. The counter is lifted to the
 * log's tail and highest id, so a commit that follows continues above both.
 * @param {IDBDatabase} db
 * @param {{ stores: Record<string, { key: IDBValidKey, value: unknown }[]>, tail: number, ids: number }} log
 */
export const import_log = async (db, log) => {
  const transaction = db.transaction([...STORE_NAMES], 'readwrite')
  let written = 0
  for (const name of STORE_NAMES) {
    const store = transaction.objectStore(name)
    for (const row of log.stores[name] ?? []) {
      put_row(store, name, row)
      written += 1
    }
  }
  store_metadata(transaction.objectStore('metadata'), log)
  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  return { written, tail: log.tail }
}

const store_metadata = (store, log) => {
  store.put({ nextId: log.ids + 1, nextSeq: log.tail + 1 }, 'state')
}

/** Open a durable IndexedDB database by name without going through the adapter. */
export const open_db = (name, version) =>
  new Promise((resolve, reject) => {
    const request = version
      ? indexedDB.open(name, version)
      : indexedDB.open(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

/** The commit sequence on each stored entry, ascending - the log's order. */
export const sequence_of = log =>
  log.stores.entries.map(({ value }) => value.commitSeq).sort((a, b) => a - b)
