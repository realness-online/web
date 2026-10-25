import {
  existsSync as exists_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { write_file_durable } from './durable.js'
import { join } from 'node:path'
import { read_request, request_key } from '#root/src/sync/actor-request.js'
import { MS_PER_HOUR } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- requests apply in the order they were made */

const MAX_AGE_MS = MS_PER_HOUR
const TIER = { idle: 'memory', stop: 'disk' }

export class ActorRequests {
  /** @type {import('./actors.js').ActorStore} */
  store
  /** @type {import('./sync-mirror.js').SyncMirror | null} */
  mirror
  /** @type {string} */
  halo
  /** @type {string} */
  file
  /** @type {() => number} */
  now
  /** @type {(message: string) => void} */
  warn
  /** @type {Record<string, string>} */
  done = {}

  /**
   * @param {import('./actors.js').ActorStore} store
   * @param {{ mirror: import('./sync-mirror.js').SyncMirror | null, halo: string, file?: string, now?: () => number, warn?: (message: string) => void }} options
   */
  constructor(
    store,
    {
      mirror,
      halo,
      file = join(store.volume, 'requests.json'),
      now = () => Date.now(),
      warn = () => {}
    }
  ) {
    Object.assign(this, { store, mirror, halo, file, now, warn })
    this.done = exists_sync(file)
      ? JSON.parse(read_file_sync(file, 'utf8'))
      : {}
  }

  /** One pass; returns what it did. Each actor's failure is its own. */
  async obey() {
    if (!this.mirror) return []
    const did = []
    for (const actor of this.store.list()) {
      if (actor.state !== 'running' && actor.state !== 'idle') continue
      try {
        const file = await this.mirror.get(request_key(this.halo, actor.id))
        const request = file && read_request(file.body.toString('utf8'))
        if (!request || this.done[actor.id] === request.id) continue
        if (this.now() - Date.parse(request.requested) > MAX_AGE_MS) continue
        if (!(request.action === 'idle' && actor.state === 'idle'))
          await this.store.idle(actor.id, TIER[request.action])
        this.done[actor.id] = request.id
        this.#save()
        did.push({ id: actor.id, action: request.action })
      } catch (error) {
        this.warn(`request for ${actor.id}: ${error.message}`)
      }
    }
    return did
  }

  #save() {
    write_file_durable(this.file, `${JSON.stringify(this.done, null, 2)}\n`)
  }
}
