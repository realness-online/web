/**
 * g5 as a library: each owner's grants, read from `people/+A/rights.html`.
 *
 * Each read carries the page's version, the stamp a later request can ask
 * for. A malformed page grants nothing; the owner can still fix it.
 */
import { read_rights } from '#root/src/can/index.js'

const rights_key = owner => `people/${owner}/rights.html`

export const rights = storage => ({
  async grants(owner) {
    const page = await storage.get(rights_key(owner))
    let grants = []
    try {
      if (page) grants = read_rights(page.body.toString('utf8'))
    } catch {
      grants = []
    }
    return { version: page?.version ?? null, grants }
  }
})
