import { createCanvas as create_canvas, loadImage as load_image } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath as file_url_to_path } from 'url'
import { oklch_to_rgb } from '../src/app/utils/color-converters.js'
import { run_entry } from './lib/entry.js'

const __filename = file_url_to_path(import.meta.url)
const __dirname = path.dirname(__filename)

const ICON_SIZE_SMALL = 192
const ICON_SIZE_LARGE = 512
const ICON_SIZES = [ICON_SIZE_SMALL, ICON_SIZE_LARGE]
const THEME_COLOR = '#dbdbd4'

export const extract_realness_symbol = icons_svg => {
  const symbol_match = icons_svg.match(
    /<symbol id="realness"[^>]*viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"[^>]*>([\s\S]*?)<\/symbol>/
  )
  if (!symbol_match)
    throw new Error('Could not find realness symbol in icons.svg')

  const [
    ,
    viewbox_x,
    viewbox_y,
    viewbox_width,
    viewbox_height,
    symbol_content
  ] = symbol_match
  const symbol_viewbox = {
    x: Number(viewbox_x),
    y: Number(viewbox_y),
    width: Number(viewbox_width),
    height: Number(viewbox_height)
  }

  const fills_match = icons_svg.match(/<defs id="fills">[\s\S]*?<\/defs>/)
  const fills_defs = fills_match ? fills_match[0] : ''

  const shapes_match = icons_svg.match(
    /<defs id="tile-shapes">[\s\S]*?<\/defs>/
  )
  const shapes_defs = shapes_match ? shapes_match[0] : ''

  return { symbol_content, fills_defs, shapes_defs, symbol_viewbox }
}

export const replace_oklch_with_rgb = svg =>
  svg.replace(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g,
    (_, l, c, h) => {
      const [r, g, b] = oklch_to_rgb(Number(l), Number(c), Number(h))
      return `rgb(${r}, ${g}, ${b})`
    }
  )

const generate_icon_png = async (size, output_path, icons_svg) => {
  const img = await render_symbol_image(size, icons_svg)
  const canvas = create_canvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = THEME_COLOR
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)

  fs.writeFileSync(output_path, canvas.toBuffer('image/png'))
}

const render_symbol_image = (size, icons_svg) => {
  const { symbol_content, fills_defs, shapes_defs, symbol_viewbox } =
    extract_realness_symbol(icons_svg)
  const { x, y, width, height } = symbol_viewbox

  const svg_content =
    replace_oklch_with_rgb(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x} ${y} ${width} ${height}">
  ${shapes_defs}
  ${fills_defs}
  ${symbol_content}
</svg>`)

  return load_image(Buffer.from(svg_content))
}

/**
 * Draw the PWA icons from the realness symbol and copy the documentation.
 * @param {{ public_dir?: string, documentation_md?: string }} [options]
 */
export const main = async ({
  public_dir = path.join(__dirname, '../public'),
  documentation_md = path.join(__dirname, '../src/app/content/documentation.md')
} = {}) => {
  const icons_svg = fs.readFileSync(path.join(public_dir, 'icons.svg'), 'utf-8')

  const stale = ['192-m.png', '512-m.png', '192-ios.png', '180.png']
  for (const name of stale) {
    const file = path.join(public_dir, name)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }

  await Promise.all(
    ICON_SIZES.map(size =>
      generate_icon_png(size, path.join(public_dir, `${size}.png`), icons_svg)
    )
  )

  fs.copyFileSync(documentation_md, path.join(public_dir, 'documentation.md'))
}

await run_entry(import.meta.url, main)
