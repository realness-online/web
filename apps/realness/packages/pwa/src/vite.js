/**
 * The kit as a Vite plugin: one call makes a build a Realness PWA.
 *
 *   realness_pwa({ profile: 'document', name: 'Blog', description: '...' })
 *
 * Shared settings, then the profile, then the caller's own workbox options.
 */
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import { pwa_manifest, pwa_plugin, pwa_workbox } from './settings.js'
import { profile as profile_options } from './profiles.js'

/**
 * @param {object} options
 * @param {'app' | 'document'} options.profile
 * @param {string} options.name
 * @param {string} options.description
 * @param {string} [options.icon_version]
 * @param {object} [options.manifest] extra manifest fields
 * @param {object} [options.workbox] extra workbox options
 * @param {object} [options.plugin] extra vite-plugin-pwa options
 */
export const realness_pwa = ({
  profile,
  name,
  description,
  icon_version,
  manifest = {},
  workbox = {},
  plugin = {}
}) =>
  vite_pwa({
    ...pwa_plugin,
    ...plugin,
    workbox: { ...pwa_workbox, ...profile_options(profile), ...workbox },
    manifest: {
      ...pwa_manifest({ name, description, icon_version }),
      ...manifest
    }
  })
