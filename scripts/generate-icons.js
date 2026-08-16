import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import crypto from 'node:crypto'
import { oklch_to_rgb } from '../src/utils/color-converters.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICON_SIZE_SMALL = 192
const ICON_SIZE_LARGE = 512
const ICON_SIZES = [ICON_SIZE_SMALL, ICON_SIZE_LARGE]
const THEME_COLOR = '#dbdbd4'

const extract_realness_symbol = icons_svg => {
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

  // the realness tiles reference fill pattern defs and tile shape paths that
  // live outside the symbol, so they must travel along with it into the
  // standalone SVG
  const fills_match = icons_svg.match(/<defs id="fills">[\s\S]*?<\/defs>/)
  const fills_defs = fills_match ? fills_match[0] : ''

  const shapes_match = icons_svg.match(
    /<defs id="tile-shapes">[\s\S]*?<\/defs>/
  )
  const shapes_defs = shapes_match ? shapes_match[0] : ''

  return { symbol_content, fills_defs, shapes_defs, symbol_viewbox }
}

// node-canvas rasterizes SVG through librsvg, which doesn't understand the
// oklch() color syntax the design system authors colors in (it renders as
// black). Convert to rgb() before handing markup to loadImage; browsers keep
// reading the un-touched oklch() in icons.svg itself.
const replace_oklch_with_rgb = svg =>
  svg.replace(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g,
    (_, l, c, h) => {
      const [r, g, b] = oklch_to_rgb(Number(l), Number(c), Number(h))
      return `rgb(${r}, ${g}, ${b})`
    }
  )

const generate_icon_png = async (size, output_path, icons_svg) => {
  const img = await render_symbol_image(size, icons_svg)
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = THEME_COLOR
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)

  fs.writeFileSync(output_path, canvas.toBuffer('image/png'))
}

const render_symbol_image = async (size, icons_svg) => {
  const { symbol_content, fills_defs, shapes_defs, symbol_viewbox } =
    extract_realness_symbol(icons_svg)
  // render at the symbol's own viewBox so the PNG's margin matches exactly
  // what browsers show for <use href="#realness">; the icon already carries
  // its own safe margin, so no extra padding is added on top here
  const { x, y, width, height } = symbol_viewbox

  const svg_content =
    replace_oklch_with_rgb(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${x} ${y} ${width} ${height}">
  ${shapes_defs}
  ${fills_defs}
  ${symbol_content}
</svg>`)

  const temp_svg_path = path.join(
    tmpdir(),
    `icon-${size}-${Date.now()}-${crypto.randomUUID()}.svg`
  )
  fs.writeFileSync(temp_svg_path, svg_content)

  const img = await loadImage(temp_svg_path)
  fs.unlinkSync(temp_svg_path)
  return img
}

const generate_all_icons = async () => {
  const icons_svg_path = path.join(__dirname, '../public/icons.svg')
  const icons_svg = fs.readFileSync(icons_svg_path, 'utf-8')
  const public_dir = path.join(__dirname, '../public')

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

  const documentation_md = path.join(
    __dirname,
    '../src/content/documentation.md'
  )
  fs.copyFileSync(documentation_md, path.join(public_dir, 'documentation.md'))
}

generate_all_icons().catch(error => {
  console.error('Failed to generate icons:', error)
  process.exit(1)
})
