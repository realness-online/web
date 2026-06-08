import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICON_SIZE_SMALL = 192
const ICON_SIZE_LARGE = 512
const ICON_SIZES = [ICON_SIZE_SMALL, ICON_SIZE_LARGE]
const THEME_COLOR = '#2c2c26'
// ~10% inset: maskable safe zone + room for iOS / desktop squircle crops
const SAFE_ZONE_PADDING = 0.1

const extract_realness_symbol = icons_svg => {
  const symbol_match = icons_svg.match(
    /<symbol id="realness"[^>]*>([\s\S]*?)<\/symbol>/
  )
  if (!symbol_match)
    throw new Error('Could not find realness symbol in icons.svg')

  const [, symbol_content] = symbol_match
  return { symbol_content }
}

const generate_icon_png = async (size, output_path, icons_svg) => {
  const { symbol_content } = extract_realness_symbol(icons_svg)
  const content_size = ICON_SIZE_SMALL
  const padded_size = content_size / (1 - SAFE_ZONE_PADDING * 2)
  const inset = (padded_size - content_size) / 2
  const padded_viewbox = `-${inset} -${inset} ${padded_size} ${padded_size}`

  const svg_content = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${padded_viewbox}">
  ${symbol_content}
</svg>`

  const temp_svg_path = path.join(
    tmpdir(),
    `icon-${size}-${Date.now()}-${crypto.randomUUID()}.svg`
  )
  fs.writeFileSync(temp_svg_path, svg_content)

  const img = await loadImage(temp_svg_path)
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = THEME_COLOR
  ctx.fillRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)

  fs.writeFileSync(output_path, canvas.toBuffer('image/png'))
  fs.unlinkSync(temp_svg_path)
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
}

generate_all_icons().catch(error => {
  console.error('Failed to generate icons:', error)
  process.exit(1)
})
