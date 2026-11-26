/**
 * l3: the local sync server admits the Mac's quarantine itself. When a local
 * halo's change lands, the same checks `realness admit` runs move what
 * passes into the vault. Admits run one at a time; a change that lands during
 * a run starts one more run after it.
 */
import { HTTP } from '#root/lib/http.js'
import { admit } from '#root/src/files/admit.js'
import { keeper } from '#root/src/sync/trash.js'
/* eslint-disable no-await-in-loop -- admits run one at a time, in order */

/** A person's own folders in the cloud, read and written as the Mac writes them. */
const cloud_tree = (storage, owner) => {
  const key = path => `people/${owner}/${path}`
  const keep = keeper(storage)
  return {
    read: async path => (await storage.get(key(path)))?.body ?? null,
    write: (path, bytes, version) =>
      storage.put(
        key(path),
        bytes,
        version === 'new' ? { if_absent: true } : { if_version: version }
      ),
    trash: async path => {
      await keep(key(path), await storage.stat(key(path)))
      await storage.delete(key(path))
    }
  }
}

/** An error `admit` reads by its status. */
const status_error = (status, message) =>
  Object.assign(new Error(message), { status })

/**
 * The owner's files on the server's own storage, in the shape `admit` reads
 * through sync: `can://~/<path>` is `people/<owner>/<path>`.
 * @param {import('#root/src/sync/server.js').SyncStorage} storage
 * @param {string} owner
 */
export const owner_store = (storage, owner) => {
  const key = url => {
    const found = /^can:\/\/~\/(.+)$/.exec(url)
    if (!found) throw new Error(`local admit: ${url} is not the owner's`)
    return `people/${owner}/${found[1]}`
  }
  return {
    cat: async url => {
      const found = await storage.get(key(url))
      if (!found) throw status_error(HTTP.NOT_FOUND, `${url} is gone`)
      return found.body
    },
    version: async url => (await storage.stat(key(url))) ?? null,
    put: async (url, body, headers = {}) => {
      const match = /^"(.+)"$/.exec(headers['if-match'] ?? '')
      try {
        await storage.put(key(url), body, match ? { if_version: match[1] } : {})
      } catch (error) {
        if (error.code === 'conflict')
          throw status_error(HTTP.PRECONDITION_FAILED, `${url} moved`)
        throw error
      }
    },
    rm: async (url, headers = {}) => {
      const match = /^"(.+)"$/.exec(headers['if-match'] ?? '')
      try {
        await storage.delete(key(url), match ? { if_version: match[1] } : {})
      } catch (error) {
        if (error.code === 'conflict')
          throw status_error(HTTP.PRECONDITION_FAILED, `${url} moved`)
        throw error
      }
    }
  }
}

/**
 * A run of admit that never overlaps another.
 * @param {{ storage: import('#root/src/sync/server.js').SyncStorage, owner: string, root: string, trash: string, run?: typeof admit, log?: (line: string) => void }} options
 */
export const local_admitter = ({
  storage,
  owner,
  root,
  trash,
  run = admit,
  log = () => {}
}) => {
  const store = owner_store(storage, owner)
  /** @type {Promise<void> | null} */
  let running = null
  let again = false

  const once = async () => {
    try {
      const { moved, waiting } = await run({ root, store, phone: owner, trash })
      log(`admit moved ${moved.length}, waiting ${waiting.length}`)
    } catch (error) {
      log(`admit failed: ${error.message}`)
    }
  }

  const loop = async () => {
    do {
      again = false
      await once()
    } while (again)
    running = null
  }

  const poke = who => {
    if (who !== owner) return running
    if (running) again = true
    else running = loop()
    return running
  }

  return {
    /** m1: admit what was held before this server started. */
    start: () => poke(owner),
    /** @param {string} who the owner whose quarantine changed */
    poke
  }
}

/**
 * c1: the cloud's own admit. Every person's quarantine is read with the code
 * the Mac runs, against the cloud's copy, while the Mac sleeps. One run at a
 * time per person; a change that lands during a run starts one more after it.
 * @param {{ storage: import('#root/src/sync/server.js').SyncStorage, run?: typeof admit, log?: (line: string) => void }} options
 */
export const cloud_admitter = ({ storage, run = admit, log = () => {} }) => {
  /** @type {Map<string, { running: Promise<void> | null, again: boolean }>} */
  const queues = new Map()

  const once = async owner => {
    try {
      const { moved, waiting } = await run({
        store: owner_store(storage, owner),
        phone: owner,
        tree: cloud_tree(storage, owner)
      })
      log(`${owner} admit moved ${moved.length}, waiting ${waiting.length}`)
    } catch (error) {
      log(`${owner} admit failed: ${error.message}`)
    }
  }

  /** @param {string} who the person whose quarantine changed */
  const poke = who => {
    if (!who.startsWith('+')) return
    const queue = queues.get(who) ?? { running: null, again: false }
    queues.set(who, queue)
    if (queue.running) {
      queue.again = true
      return queue.running
    }
    queue.running = (async () => {
      do {
        queue.again = false
        await once(who)
      } while (queue.again)
      queue.running = null
    })()
    return queue.running
  }

  return {
    /** Admits what was held before this server started. */
    start: async () => {
      const { folders } = await storage.list('people')
      await Promise.all(folders.map(poke))
    },
    poke
  }
}
