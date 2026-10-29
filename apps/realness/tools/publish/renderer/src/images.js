import sharp from 'sharp'
import {
  readdir,
  readFile as read_file,
  writeFile as write_file,
  mkdir
} from 'node:fs/promises'
import { join } from 'node:path'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/** @typedef {ReturnType<typeof create_images>} Images */

/**
 * Image caches belong to one build, never to the watcher process.
 * @param {string} default_poster
 */
export const create_images = default_poster => {
  const posters = 'static/posters'
  const output = 'dist/og'
  const poster_sizes = {}
  const og_images = new Map()

  const render_image = async name => {
    if (
      typeof name !== 'string' ||
      /[/\\\x00-\x1f]/.test(name) ||
      !/\.svg$/i.test(name)
    )
      throw new Error(`invalid poster name: ${name}`)
    const out_name = name.replace(/\.svg$/i, '.jpg')
    const path = `/og/${encodeURIComponent(out_name)}`
    await mkdir(output, { recursive: true })
    const svg = await read_file(join(posters, name), 'utf8')
    const complete_svg =
      svg.includes('id="background"') && !svg.includes('href="#background"')
        ? svg.replace(
            /(<svg\b[^>]*>)/,
            '$1<use itemprop="background" href="#background"/>'
          )
        : svg
    const buffer = await sharp(Buffer.from(complete_svg), { density: 150 })
      .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer()
    await write_file(join(output, out_name), buffer)
    return path
  }

  return {
    poster_sizes,
    /** Cache the pending render too: parallel articles share one raster operation. @param {string} [img] */
    raster_og_image(img) {
      const name = img || default_poster
      if (!og_images.has(name)) og_images.set(name, render_image(name))
      return og_images.get(name)
    },

    async load_poster_sizes() {
      for (const name of await readdir(posters)) {
        if (!name.endsWith('.svg')) continue
        const svg = await read_file(join(posters, name), 'utf8')
        const box = svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/)
        if (box)
          poster_sizes[name] = { width: Number(box[1]), height: Number(box[2]) }
      }
    }
  }
}
