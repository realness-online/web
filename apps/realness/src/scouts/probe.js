import { scout_preflight } from './preflight.js'

/** The first login source: YC's startup directory, read through its saved jar. */
export const PROBE_SITE = 'yc'
export const PROBE_URL = 'https://www.workatastartup.com/'

/**
 * What a b6 attempt needs before a run is worth its minutes: the preflight gates
 * and a saved login. The box reads the directory itself, with its own Chrome.
 * @param {{ store: { free_bytes: () => number }, jars: { load: Function } | null }} halo
 * @param {string} owner
 */
export const scout_probe = async (halo, owner) => {
  const { free } = scout_preflight(halo)
  const cookies = halo.jars ? await halo.jars.load(owner, PROBE_SITE) : []
  if (!cookies.length)
    throw new Error(
      `no saved ${PROBE_SITE} login; import one with scripts/cookie-import.js`
    )
  return { free, cookies: cookies.length }
}
