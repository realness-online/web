/**
 * How a site's worker caches, by kind of site.
 *
 * app: an app shell. Everything is precached; navigation falls back to the
 * shell, so every route opens offline. New builds land on the update rule.
 *
 * document: pages people read. HTML comes from the network first, so a reader
 * always gets the current page without a reload; the cache answers offline.
 * Styles, scripts, fonts, and images are precached and update silently.
 */

/** The document profile's page cache; register_pwa warms it. */
export const PAGES_CACHE = 'pages'

const NETWORK_TIMEOUT_SECONDS = 3
const PAGES_KEPT = 200

/** Files a document site precaches; its HTML is fetched network first. */
const DOCUMENT_ASSETS = '**/*.{fragment,css,js,png,jpg,svg,woff2}'

/** @type {Record<string, (options: { fallback?: string }) => object>} */
export const PROFILES = {
  app: ({ fallback = 'index.html' } = {}) => ({
    navigateFallback: fallback,
    navigateFallbackDenylist: [/\.(?:xml|txt|md|json)$/i]
  }),
  document: () => ({
    globPatterns: [DOCUMENT_ASSETS],
    navigateFallback: null,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: PAGES_CACHE,
          networkTimeoutSeconds: NETWORK_TIMEOUT_SECONDS,
          expiration: { maxEntries: PAGES_KEPT }
        }
      }
    ]
  })
}

/**
 * Workbox options for a profile.
 * @param {keyof typeof PROFILES} name
 * @param {{ fallback?: string }} [options]
 */
export const profile = (name, options = {}) => {
  const make = PROFILES[name]
  if (!make) throw new Error(`unknown PWA profile: ${name}`)
  return make(options)
}
