import { logger } from './log.js'

const CONTENT_MS = 20_000
const CONTENT_TEXT = 2000
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const LOG = logger('site-read')

/** A DevTools URL as the bare address a render takes. */
export const address_of = devtools => new URL(devtools).hostname

/** A jar's cookies as the one request header a server reads. */
export const cookie_header = cookies =>
  cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')

/**
 * The text a page shows, without its scripts, styles, or markup. A page whose
 * list is drawn by JavaScript comes back long and nearly wordless, which is
 * what tells it apart from one the server filled in.
 */
export const visible_text = html =>
  html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z][a-z0-9]{1,7};/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A site's page from its own server, with the saved login on the request. Most
 * login sources render their list server-side, so this answers in milliseconds,
 * and the rendered fallback only runs for a page that comes back thin.
 * @param {string} url
 * @param {{ name: string, value: string }[]} cookies
 * @param {typeof fetch} [fetcher]
 */
const static_read = async (url, cookies, fetcher = fetch) => {
  const reply = await fetcher(url, {
    headers: {
      cookie: cookie_header(cookies),
      'user-agent': CHROME_UA,
      accept: 'text/html',
      'accept-language': 'en-US,en;q=0.9'
    },
    signal: AbortSignal.timeout(CONTENT_MS)
  })
  const html = reply.ok ? await reply.text() : ''
  return { status: reply.status, html }
}

/**
 * A site's page through its saved login: a plain fetch carrying the jar first,
 * and the owner's own Chrome only when the server's page comes back thin. The
 * jar never leaves the halo; the Chrome is the box's own.
 * @param {string} url
 * @param {{ cookies?: { name: string, value: string }[], render?: ((url: string) => Promise<{ status: number, html: string }>) | null, fetcher?: typeof fetch }} [tools]
 * @returns {Promise<{ status: number, html: string, source: 'static' | 'chrome' }>}
 */
export const site_read = async (
  url,
  { cookies = [], render = null, fetcher = fetch } = {}
) => {
  if (cookies.length) {
    const plain = await static_read(url, cookies, fetcher)
    LOG.info(`static ${plain.status} ${plain.html.length} ${url}`)
    if (visible_text(plain.html).length > CONTENT_TEXT)
      return { ...plain, source: 'static' }
  }
  if (!render)
    throw new Error(
      `no Chrome to render ${url}, and its server sent a thin page`
    )
  const started = Date.now()
  const page = await render(url)
  LOG.info(`render ${Date.now() - started}ms ${page.html.length} ${url}`)
  return { ...page, source: 'chrome' }
}
