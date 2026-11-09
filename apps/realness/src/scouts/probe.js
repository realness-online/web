import { site_read } from '#root/src/halo/site-read.js'
import { scout_preflight } from './preflight.js'

/** The first login source: YC's startup directory, read through its saved jar. */
export const PROBE_SITE = 'yc'
export const PROBE_URL = 'https://www.workatastartup.com/'
const DIRECTORY = /Directory \| Y Combinator/

/**
 * What a b6 attempt needs before it is worth 30 minutes: the preflight gates,
 * a saved login, and one directory read through a lease that comes back. The
 * copy is given back whatever the read says.
 * @param {{ store: { free_bytes: () => number }, chrome: any }} halo
 * @param {{ id: string, owner: string, actor_ip: string }} actor
 * @param {(address: string, url: string) => Promise<{ status: number | null, html: string }>} [render]
 */
export const scout_probe = async (halo, actor, render) => {
  const { free } = await scout_preflight(halo)
  const { jars } = halo.chrome
  const cookies = jars ? await jars.load(actor.owner, PROBE_SITE) : []
  if (!cookies.length)
    throw new Error(
      `no saved ${PROBE_SITE} login; import one with scripts/cookie-import.js`
    )
  const page = await site_read(
    halo,
    { ...actor, site: PROBE_SITE },
    PROBE_URL,
    render
  )
  if (!DIRECTORY.test(page.html))
    throw new Error(
      `${PROBE_SITE} shows no directory (HTTP ${page.status}); its login may have expired`
    )
  return { free, status: page.status, cookies: cookies.length }
}
