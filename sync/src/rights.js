/**
 * g5 as a library: each owner's grants, read from `people/+A/rights.html`.
 *
 * Each entry carries the page's version, the stamp a later request can ask
 * for. Sync is the only writer, so a write through it forgets the entry at
 * once. A malformed page grants nothing; the owner can still fix it.
 */
import { read_rights } from "brayness-can"

export const rights_key = (owner) => `people/${owner}/rights.html`

export function rights(storage) {
  const cache = new Map() // owner -> { version, grants }
  const generation = new Map() // owner -> count of forgets, so a slow read never caches stale

  return {
    async grants(owner) {
      const hit = cache.get(owner)
      if (hit) return hit
      const started = generation.get(owner) ?? 0
      const page = await storage.get(rights_key(owner))
      let grants = []
      try {
        if (page) grants = read_rights(page.body.toString("utf8"))
      } catch {
        grants = []
      }
      const entry = { version: page?.version ?? null, grants }
      if ((generation.get(owner) ?? 0) === started) cache.set(owner, entry)
      return entry
    },

    forget(owner) {
      cache.delete(owner)
      generation.set(owner, (generation.get(owner) ?? 0) + 1)
    },
  }
}
