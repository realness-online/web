/** @type {null | ((event: string, detail: object) => void)} */
let sink = null

/**
 * Tests set `sink` to record profile sync steps (multi-device debugging).
 * @param {((event: string, detail: object) => void) | null} fn
 */
export const set_profile_sync_log_sink = fn => {
  sink = fn
}

/**
 * @param {string} event
 * @param {object} [detail]
 */
export const profile_sync_log = (event, detail = {}) => {
  if (sink) sink(event, detail)
}
