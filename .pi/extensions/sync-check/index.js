/**
 * w1: each turn reads the person's cloud hash page, and on a change runs the
 * Mac's door - pull, admit - before the agent starts. w2: the turn then starts
 * with one line saying what arrived and what waits.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { turn_at } from 'realness/files/sync-check'

export const sync_check = (/** @type {ExtensionAPI} */ pi, { turn = turn_at } = {}) => {
  pi.on('before_agent_start', async () => {
    const line = await turn()
    if (!line) return
    return {
      message: { customType: 'sync-check', content: line, display: true }
    }
  })
}

export default (/** @type {ExtensionAPI} */ pi) => sync_check(pi)
