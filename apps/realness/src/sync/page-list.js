/**
 * A page of items, newest first, kept short. Two writers racing both land:
 * each write is guarded on the version it read, and a loser reads again.
 */

/**
 * The items of one type on a page, without the markup around them.
 * @param {string} html
 * @param {string} type
 */
const items_of = (html, type) =>
  [
    ...html.matchAll(
      new RegExp(
        `<article itemscope itemtype="/${type}">[\\s\\S]*?</article>`,
        'g'
      )
    )
  ].map(([item]) => item)

/**
 * Put one item at the top of the page at `key`.
 * @param {{ storage: import('./server.js').SyncStorage, key: string, head: string, tail: string, type: string, item: string, kept: number }} options
 * @returns {Promise<string | null>} the page written, or null when every try lost
 */
/* eslint-disable no-await-in-loop -- a retry reads the version it just lost */
export const prepend_item = async ({
  storage,
  key,
  head,
  tail,
  type,
  item,
  kept
}) => {
  for (let tries = 0; tries < 3; tries++) {
    const current = await storage.get(key).catch(() => null)
    const page = current ? current.body.toString('utf8') : head + tail
    const next =
      head +
      item +
      items_of(page, type)
        .slice(0, kept - 1)
        .join('') +
      tail
    try {
      await storage.put(
        key,
        next,
        current ? { if_version: current.version } : { if_absent: true }
      )
      return next
    } catch (error) {
      if (!current && tries === 2) throw error
    }
  }
  return null
}
