/** Generated-worker rules; no dependencies, so app specs can import them. */
const SKIP_WAITING_HANDLER = /["'`]SKIP_WAITING["'`][^;}]*?skipWaiting\(\)/g

/** Precached paths in a generated worker, site-relative with no query. */
export const precached = text =>
  new Set([...text.matchAll(/["']?\burl["']?:\s*["']([^"']+)["']/g)].map(([, url]) => url.replace(/^\/+/, '').split('?')[0]))

/**
 * Navigations answer offline: the app profile's shell fallback, or the
 * document profile's network-first page cache.
 */
export const navigation_offline = text =>
  /createHandlerBoundToURL|NavigationRoute/.test(text) ||
  (/NetworkFirst/.test(text) && /["']navigate["']/.test(text))

/**
 * Worker rules every Realness PWA keeps: it waits until told (prompt mode),
 * claims open pages, and serves navigation offline. Hits are { rule, text }.
 */
export const check_worker = text => {
  const hits = []
  if (!SKIP_WAITING_HANDLER.test(text))
    hits.push({ rule: 'pwa-prompt', text: 'worker never activates on a SKIP_WAITING message' })
  else if (/skipWaiting\(\)/.test(text.replace(SKIP_WAITING_HANDLER, '')))
    hits.push({ rule: 'pwa-prompt', text: 'worker skips waiting on its own; updates would interrupt open pages' })
  SKIP_WAITING_HANDLER.lastIndex = 0
  if (!/clientsClaim\(\)|clients\.claim\(\)/.test(text))
    hits.push({ rule: 'pwa-claim', text: 'worker does not claim open pages' })
  return hits
}
