import { GIB } from '#root/lib/units.js'

/** Free space a run needs: one Chrome copy and the finds it writes. */
export const FREE_BYTES = 2 * GIB

/**
 * The gates a scout run clears before pi starts: free space on the actors
 * volume, and a fresh Chrome copy that answers DevTools. The copy is destroyed
 * on the spot, so no lease is inherited by the run.
 * @param {{ store: { free_bytes: () => number }, chrome: { pool: { restore: () => Promise<{ n: number }>, destroy: (n: number) => Promise<unknown> } } | null }} halo
 * @returns {Promise<{ free: number }>}
 */
export const scout_preflight = async ({ store, chrome }) => {
  const free = store.free_bytes()
  if (free < FREE_BYTES)
    throw new Error(
      `the actors volume has ${Math.floor(free / GIB)} GiB free; a run needs ${FREE_BYTES / GIB}`
    )
  if (!chrome) throw new Error('this halo has no chrome pool')
  const { n } = await chrome.pool.restore()
  await chrome.pool.destroy(n)
  return { free }
}
