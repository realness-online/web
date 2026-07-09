import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import crypto from 'node:crypto'
import {
  og_image_cta,
  og_image_headline,
  og_image_subhead
} from '../src/prerender/pages.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICON_SIZE_SMALL = 192
const ICON_SIZE_LARGE = 512
const ICON_SIZES = [ICON_SIZE_SMALL, ICON_SIZE_LARGE]
const OG_WIDTH = 1200
const OG_HEIGHT = 630
const OG_ICON_SCALE = 0.28
const OG_ICON_TOP = 64
const OG_TEXT_GAP = 40
const OG_HEADLINE_STEP = 72
const OG_SUBHEAD_STEP = 64
const OG_CTA_FONT_SIZE = 40
const OG_CTA_PADDING_X = 44
const OG_CTA_PADDING_Y = 22
const THEME_COLOR = '#2c2c26'
const TEXT_COLOR = 'rgba(215, 214, 203, 0.95)'
const ACCENT_COLOR = '#EC364C'
const CTA_TEXT_COLOR = '#ffffff'
// ~10% inset: maskable safe zone + room for iOS / desktop squircle crops
const SAFE_ZONE_PADDING = 0.1

const extract_realness_symbol = icons_svg => {
  const symbol_match = icons_svg.match(
    /<symbol id="realness"[^>]*>([\s\S]*?)<\/symbol>/
  )
  if (!symbol_match)
    throw new Error('Could not find realness symbol in icons.svg')

  const [, symbol_content] = symbol_match

  // the realness tiles reference smalti mask/pattern defs that live outside
  // the symbol, so they must travel along with it into the standalone SVG
  const smalti_match = icons_svg.match(
    /<defs id="smalti">[\s\S]*?<\/defs>/
  )
  const smalti_defs = smalti_match ? smalti_match[0] : ''

  return { symbol_content, smalti_defs }
}

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
  const { symbol_content, smalti_defs } = extract_realness_symbol(icons_svg)
  const content_size = ICON_SIZE_SMALL
  const padded_size = content_size / (1 - SAFE_ZONE_PADDING * 2)
  const inset = (padded_size - content_size) / 2
  const padded_viewbox = `-${inset} -${inset} ${padded_size} ${padded_size}`

  const svg_content = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${padded_viewbox}">
  ${smalti_defs}
  ${symbol_content}
</svg>`

  const temp_svg_path = path.join(
    tmpdir(),
    `icon-${size}-${Date.now()}-${crypto.randomUUID()}.svg`
  )
  fs.writeFileSync(temp_svg_path, svg_content)

  const img = await loadImage(temp_svg_path)
  fs.unlinkSync(temp_svg_path)
  return img
}

const generate_og_png = async (output_path, icons_svg) => {
  const icon_size = Math.round(OG_HEIGHT * OG_ICON_SCALE)
  const img = await render_symbol_image(icon_size, icons_svg)
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = THEME_COLOR
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT)

  const icon_y = OG_ICON_TOP
  ctx.drawImage(img, (OG_WIDTH - icon_size) / 2, icon_y, icon_size, icon_size)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  let y = icon_y + icon_size + OG_TEXT_GAP

  ctx.fillStyle = TEXT_COLOR
  ctx.font = 'bold 64px Helvetica, Arial, sans-serif'
  ctx.fillText(og_image_headline, OG_WIDTH / 2, y)
  y += OG_HEADLINE_STEP

  ctx.font = '36px Helvetica, Arial, sans-serif'
  ctx.fillText(og_image_subhead, OG_WIDTH / 2, y)
  y += OG_SUBHEAD_STEP

  const cta_font = `bold ${OG_CTA_FONT_SIZE}px Helvetica, Arial, sans-serif`
  ctx.font = cta_font
  const cta_width = ctx.measureText(og_image_cta).width
  const pill_width = cta_width + OG_CTA_PADDING_X * 2
  const pill_height = OG_CTA_FONT_SIZE + OG_CTA_PADDING_Y * 2
  const pill_x = (OG_WIDTH - pill_width) / 2

  ctx.fillStyle = ACCENT_COLOR
  ctx.beginPath()
  ctx.roundRect(pill_x, y, pill_width, pill_height, pill_height / 2)
  ctx.fill()

  ctx.fillStyle = CTA_TEXT_COLOR
  ctx.textBaseline = 'middle'
  ctx.fillText(og_image_cta, OG_WIDTH / 2, y + pill_height / 2)

  fs.writeFileSync(output_path, canvas.toBuffer('image/png'))
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
  await generate_og_png(path.join(public_dir, 'og.png'), icons_svg)

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
