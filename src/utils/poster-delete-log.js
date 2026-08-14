/**
 * Temporary instrumentation for the vanishing-poster hunt. Every path that can
 * drop a poster from the feed or purge it from storage says so here, with the
 * stack that got it there. Filter the console on `[poster-delete]`.
 *
 * Delete this file, and its callers, once the culprit is caught.
 *
 * @param {string} where
 * @param {Record<string, unknown>} [detail]
 */
export const poster_delete_log = (where, detail = {}) => {
  console.info(`[poster-delete] ${where}`, detail, new Error('trace').stack)
}
