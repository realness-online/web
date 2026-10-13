/**
 * Instrumentation for the vanishing-poster hunt. Every path that can drop a
 * poster from the feed or purge it from storage says so here, with the stack
 * that got it there.
 *
 * Silent unless you ask for it, so it can stay in place while the bug is
 * unreproducible:
 *
 *   localStorage['debug:poster-delete'] = 'on'
 *
 * Delete this file, and its callers, once the culprit is caught.
 *
 * @param {string} where
 * @param {Record<string, unknown>} [detail]
 */
export const poster_delete_log = (where, detail = {}) => {
  if (typeof window === 'undefined') return
  if (window.localStorage?.['debug:poster-delete'] !== 'on') return
  console.info(`[poster-delete] ${where}`, detail, new Error('trace').stack)
}
