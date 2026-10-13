import { writeFile as write_file } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { resolveConfig as resolve_config } from 'vite'
import { VitePWA as vite_pwa } from 'vite-plugin-pwa'

/** Generate a worker for the selected public snapshot through the plugin's integration API. */
export const build_pwa = async site => {
  const plugins = vite_pwa({
    filename: 'service.worker.js',
    injectRegister: false,
    registerType: 'prompt',
    workbox: {
      globPatterns: ['**/*.{html,fragment,css,js,png,jpg,svg,woff2}'],
      globIgnores: ['**/service.worker.js', '**/workbox-*.js'],
      maximumFileSizeToCacheInBytes: 6000000,
      navigateFallback: null,
      clientsClaim: true
    },
    manifest: {
      name: site.name,
      short_name: site.name,
      description: site.description,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: 'en',
      theme_color: '#2c2c26',
      background_color: '#2c2c26',
      icons: [
        { src: '/192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    }
  })
  await resolve_config({
    configFile: false,
    root: resolve('.'),
    base: '/',
    publicDir: 'static',
    build: { outDir: 'dist' },
    plugins
  }, 'build')
  const plugin = plugins.find(plugin => plugin.name === 'vite-plugin-pwa')
  const bundle = plugin.api.generateBundle({})
  for (const asset of Object.values(bundle)) await write_file(join('dist', asset.fileName), asset.source)
  await plugin.api.generateSW()
}
