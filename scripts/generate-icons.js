import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const extract_realness_symbol = icons_svg => {
  const symbol_match = icons_svg.match(
    /<symbol id="realness"[^>]*>([\s\S]*?)<\/symbol>/
  )
  if (!symbol_match)
    throw new Error('Could not find realness symbol in icons.svg')

  const [, symbol_content] = symbol_match
  const viewbox_match = symbol_match[0].match(/viewBox="([^"]+)"/)
  const viewbox = viewbox_match ? viewbox_match[1] : '-20 -20 232 232'

  return { symbol_content, viewbox }
}

const generate_icon_png = async (size, output_path, icons_svg) => {
  const { symbol_content, viewbox } = extract_realness_symbol(icons_svg)

  const svg_content = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewbox}">
  ${symbol_content}
</svg>`

  const temp_svg_path = path.join(tmpdir(), `icon-${size}-${Date.now()}.svg`)
  fs.writeFileSync(temp_svg_path, svg_content)

  const img = await loadImage(temp_svg_path)
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(img, 0, 0, size, size)

  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(output_path, buffer)
  fs.unlinkSync(temp_svg_path)
}

const ICON_SIZE_SMALL = 192
const ICON_SIZE_LARGE = 512

const generate_all_icons = async () => {
  const icons_svg_path = path.join(__dirname, '../public/icons.svg')
  const icons_svg = fs.readFileSync(icons_svg_path, 'utf-8')
  const public_dir = path.join(__dirname, '../public')

  await generate_icon_png(
    ICON_SIZE_SMALL,
    path.join(public_dir, '192.png'),
    icons_svg
  )
  await generate_icon_png(
    ICON_SIZE_LARGE,
    path.join(public_dir, '512.png'),
    icons_svg
  )
}

generate_all_icons().catch(error => {
  console.error('Failed to generate icons:', error)
  process.exit(1)
})
