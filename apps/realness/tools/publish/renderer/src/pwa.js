import { existsSync as exists } from 'node:fs'
import { writeFile as write_file } from 'node:fs/promises'
import sharp from 'sharp'
import { join, resolve } from 'node:path'
import { resolveConfig as resolve_config } from 'vite'
import { realness_pwa } from '#root/packages/pwa/src/vite.js'

const ICON_SIZES = [192, 512]

/**
 * The manifest names a 192 and a 512 icon; make whichever is missing from
 * the one the site has. A site may ship its own sharper 512.png in static/.
 */
const fill_icons = async (dir = 'dist') => {
  const have = ICON_SIZES.find(size => exists(join(dir, `${size}.png`)))
  if (!have) throw new Error('a PWA needs 192.png or 512.png in static/')
  for (const size of ICON_SIZES)
    if (!exists(join(dir, `${size}.png`)))
      await sharp(join(dir, `${have}.png`))
        .resize(size, size)
        .png()
        .toFile(join(dir, `${size}.png`))
}

/** Generate a worker for the selected public snapshot through the plugin's integration API. */
export const build_pwa = async site => {
  const plugins = realness_pwa({
    profile: site.pwa_profile ?? 'document',
    name: site.name,
    description: site.description,
    plugin: { injectRegister: false },
    workbox: {
      globIgnores: ['**/service.worker.js', '**/workbox-*.js'],
      maximumFileSizeToCacheInBytes: 6000000
    }
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
  await fill_icons()
  await plugin.api.generateSW()
}
