import { render_page } from './chrome-pool.js'
import { logger } from './log.js'

const CONTENT_MS = 20_000
const LOG = logger('site-read')

/** A lease's DevTools URL as the bare address `render_page` takes. */
export const address_of = devtools => new URL(devtools).hostname

/**
 * Read one page through a leased copy that carries a site's cookie jar. The
 * copy goes back whatever the read says, so a login source holds one lease at
 * a time and never leaves one behind.
 * @param {{ chrome: any }} halo the door, whose chrome leases and jars it uses
 * @param {{ id: string, owner: string, actor_ip: string, site: string }} actor
 * @param {string} url
 * @param {(address: string, url: string, options: { wait: string, settle_ms: number }) => Promise<{ status: number | null, html: string }>} [render]
 */
export const site_read = async (
  halo,
  { id, owner, actor_ip, site },
  url,
  render = render_page
) => {
  const started = Date.now()
  const lease = await halo.chrome.lease(id, actor_ip, { site, owner })
  const leased = Date.now()
  try {
    const page = await render(address_of(lease.devtools), url, {
      wait: 'content',
      settle_ms: CONTENT_MS
    })
    LOG.info(
      `${id} ${site} lease ${leased - started}ms, render ${Date.now() - leased}ms, ${page.html.length} bytes`
    )
    return { ...page, site }
  } finally {
    await halo.chrome.give_back(id)
  }
}
