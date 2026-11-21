import { mkdir, writeFile as write_file } from 'node:fs/promises'
import { join } from 'node:path'
import { load_theme } from '#root/themes/load.js'
import { web } from '#root/themes/adapters/web.js'

const THEMES = join(import.meta.dirname, '../../themes')

/**
 * Write a theme's `palette.css` and `color.css` into a site's static folder,
 * where every frame links them.
 * @param {string} static_dir
 * @param {string} name a folder in `themes/`
 */
export const write_palette = async (static_dir, name) => {
  const theme = load_theme(join(THEMES, name), name)
  await mkdir(static_dir, { recursive: true })
  await write_file(join(static_dir, 'palette.css'), theme.palette)
  await write_file(join(static_dir, 'color.css'), web(theme.schemes))
}
