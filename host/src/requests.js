// o6: admin requests that an actor idle or stop, read through sync.
//   hosts/<name>/requests/<actor>.html   see sync/src/actor-request.js
// Each pass checks every actor that is not already stopped. A request is
// obeyed once: the last obeyed id per actor lives in <volume>/requests.json,
// so a host restart does not idle a person's actor a second time.
// Requests older than MAX_AGE are ignored, so a host back from a long stop
// does not act on stale wishes.
import { existsSync as exists_sync, readFileSync as read_file_sync } from "node:fs"
import { writeFileDurable as write_file_durable } from "./durable.js"
import { join } from "node:path"
import { read_request, request_key } from "../../sync/src/actor-request.js"

const MAX_AGE_MS = 60 * 60 * 1000
const TIER = { idle: "memory", stop: "disk" }

export class ActorRequests {
  constructor(store, { mirror, host, file = join(store.volume, "requests.json"), now = () => Date.now(), warn = () => {} }) {
    Object.assign(this, { store, mirror, host, file, now, warn })
    this.done = exists_sync(file) ? JSON.parse(read_file_sync(file, "utf8")) : {}
  }

  /** One pass; returns what it did. Each actor's failure is its own. */
  async obey() {
    if (!this.mirror) return []
    const did = []
    for (const actor of this.store.list()) {
      if (actor.state !== "running" && actor.state !== "idle") continue
      try {
        const file = await this.mirror.get(request_key(this.host, actor.id))
        const request = file && read_request(file.body.toString("utf8"))
        if (!request || this.done[actor.id] === request.id) continue
        if (this.now() - Date.parse(request.requested) > MAX_AGE_MS) continue
        // idle on an idle actor is already done; stop drops its snapshot.
        if (!(request.action === "idle" && actor.state === "idle")) await this.store.idle(actor.id, TIER[request.action])
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
