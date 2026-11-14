/**
 * s1: a vault save reaches an open view without polling. One stream of events
 * per open page, named after the path that changed.
 */

/**
 * @typedef {{ listen: (response: import('node:http').ServerResponse) => void, send: (path: string) => void, count: () => number }} VaultEvents
 */

/**
 * A broadcaster for vault writes. A listener is one open event stream; it
 * closes itself when the page goes away.
 * @returns {VaultEvents}
 */
const OK = 200

export const vault_events = () => {
  /** @type {Set<import('node:http').ServerResponse>} */
  const listeners = new Set()
  return {
    listen(response) {
      response.writeHead(OK, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive'
      })
      response.write(': open\n\n')
      listeners.add(response)
      response.on('close', () => listeners.delete(response))
    },
    send(path) {
      const event = `data: ${JSON.stringify({ path })}\n\n`
      for (const response of listeners) response.write(event)
    },
    count: () => listeners.size
  }
}

/** A vault record a reader cares about: a note under the person's vault. */
export const is_vault_note = path => /^people\/[^/]+\/vault\/.+\.md$/.test(path)
