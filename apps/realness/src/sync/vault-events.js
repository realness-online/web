/**
 * s1: a vault save reaches an open view without polling. One stream of events
 * per open page, named after the path that changed.
 */
import { item_html } from '#root/lib/items.js'

/**
 * @typedef {{ listen: (response: import('node:http').ServerResponse, prefix?: string) => void, send: (path: string) => void, count: () => number }} VaultEvents
 */

/**
 * A broadcaster for vault writes. A listener is one open event stream; it
 * closes itself when the page goes away.
 * @returns {VaultEvents}
 */
const OK = 200

export const vault_events = () => {
  /** @type {Map<import('node:http').ServerResponse, string>} */
  const listeners = new Map()
  return {
    listen(response, prefix = '') {
      response.writeHead(OK, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive'
      })
      response.write(': open\n\n')
      listeners.set(response, prefix)
      response.on('close', () => listeners.delete(response))
    },
    send(path) {
      const event = `data: ${item_html('change', { path }).trim()}\n\n`
      for (const [response, prefix] of listeners)
        if (path.startsWith(prefix)) response.write(event)
    },
    count: () => listeners.size
  }
}

/** A vault record a reader cares about: a note under the person's vault. */
export const is_vault_note = path => /^people\/[^/]+\/vault\/.+\.md$/.test(path)
