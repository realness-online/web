import { writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { resolveConfig as resolve_config } from 'vite'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'
import {
  pwa_manifest,
  pwa_plugin,
  pwa_workbox
} from '#root/src/settings/pwa.js'

/** Generate a worker for the selected public snapshot through the plugin's integration API. */
export const build_pwa = async site => {
  const plugins = vite_pwa({
    ...pwa_plugin,
    injectRegister: false,
    workbox: {
      ...pwa_workbox,
      globPatterns: ['**/*.{html,fragment,css,js,png,jpg,svg,woff2}'],
      globIgnores: ['**/service.worker.js', '**/workbox-*.js'],
      maximumFileSizeToCacheInBytes: 6000000,
      navigateFallback: null
    },
    manifest: pwa_manifest(site)
  })
  await resolve_config(
    {
      configFile: false,
      root: resolve('.'),
      base: '/',
      publicDir: 'static',
      build: { outDir: 'dist' },
      plugins
    },
    'build'
  )
  const plugin = plugins.find(plugin => plugin.name === 'vite-plugin-pwa')
  if (!plugin) throw new Error('the PWA plugin did not load')
  const bundle = plugin.api.generateBundle({})
  for (const asset of Object.values(bundle))
    await write_file(join('dist', asset.fileName), asset.source)
  await plugin.api.generateSW()
}
