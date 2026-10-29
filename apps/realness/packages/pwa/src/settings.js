/**
 * PWA settings shared by the app build and the site renderer.
 *
 * Prompt mode is what lets updates land unseen: a new worker waits until the
 * page's update rule (watch-for-updates.js) posts SKIP_WAITING while hidden.
 * Callers add only what differs: offline navigation and cache size.
 */

export const PWA_COLOR = '#2c2c26'
const ICON_SIZES = ['192', '512']

/**
 * vite-plugin-pwa options both builds share.
 * @type {{ filename: string, registerType: 'prompt' }}
 */
export const pwa_plugin = {
  filename: 'service.worker.js',
  registerType: 'prompt'
}

/** Workbox options both builds share. */
export const pwa_workbox = { clientsClaim: true }

/**
 * The web app manifest both builds write; `display` is a manifest keyword,
 * not any string.
 * @param {{ name: string, description: string, icon_version?: string }} site
 * @returns {Partial<import('vite-plugin-pwa').ManifestOptions>}
 */
export const pwa_manifest = ({ name, description, icon_version }) => ({
  name,
  short_name: name,
  description,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  lang: 'en',
  theme_color: PWA_COLOR,
  background_color: PWA_COLOR,
  icons: ICON_SIZES.map(size => ({
    src: `/${size}.png${icon_version ? `?v=${icon_version}` : ''}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'any maskable'
  }))
})
