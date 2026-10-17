const BRAILLE_START = 0x2800
const BRAILLE_END = 0x28ff
const LOWER_START = 0x2581
const LOWER_END = 0x2588
const LEFT_START = 0x2589
const LEFT_END = 0x258f
const EIGHTHS = 8
const BRAILLE_ROWS = 4
const BRAILLE_COLUMNS = 2
const FONT_PER_STROKE = 14
const DOT_SHARE = 0.5

/** Which cell edges a light box-drawing character reaches: up, right, down, left. */
const LINES = {
  '─': [0, 1, 0, 1],
  '│': [1, 0, 1, 0],
  '┌': [0, 1, 1, 0],
  '┐': [0, 0, 1, 1],
  '└': [1, 1, 0, 0],
  '┘': [1, 0, 0, 1],
  '╭': [0, 1, 1, 0],
  '╮': [0, 0, 1, 1],
  '╰': [1, 1, 0, 0],
  '╯': [1, 0, 0, 1],
  '├': [1, 1, 1, 0],
  '┤': [1, 0, 1, 1],
  '┬': [0, 1, 1, 1],
  '┴': [1, 1, 0, 1],
  '┼': [1, 1, 1, 1]
}

/** Braille dot bits in Unicode order, as [column, row] within the cell. */
const DOTS = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [0, 3],
  [1, 3]
]

/**
 * Lines run through the cell center to its edges, so neighbors join across
 * rows taller than the font.
 */
const draw_lines = (ctx, edges, { x, y, w, h, font_size }) => {
  const stroke = Math.max(1, Math.round(font_size / FONT_PER_STROKE))
  const cx = x + Math.floor((w - stroke) / 2)
  const cy = y + Math.floor((h - stroke) / 2)
  const [up, right, down, left] = edges
  if (up) ctx.fillRect(cx, y, stroke, cy - y + stroke)
  if (down) ctx.fillRect(cx, cy, stroke, y + h - cy)
  if (left) ctx.fillRect(x, cy, cx - x + stroke, stroke)
  if (right) ctx.fillRect(cx, cy, x + w - cx, stroke)
}

/** Dots spread over the whole cell height, two columns by four rows. */
const draw_braille = (ctx, bits, { x, y, w, h }) => {
  const size = Math.max(1, Math.round((w / BRAILLE_COLUMNS) * DOT_SHARE))
  DOTS.forEach(([column, row], bit) => {
    if (!(bits & (1 << bit))) return
    const cx = x + ((column + DOT_SHARE) * w) / BRAILLE_COLUMNS
    const cy = y + ((row + DOT_SHARE) * h) / BRAILLE_ROWS
    ctx.fillRect(
      Math.round(cx - size / 2),
      Math.round(cy - size / 2),
      size,
      size
    )
  })
}

/**
 * Draw box lines, block elements, and Braille as shapes that fill the cell,
 * as native terminals do, instead of font glyphs that leave gaps when rows
 * are taller than the font. Returns false for any other text.
 * @param {CanvasRenderingContext2D} ctx fillStyle already set
 * @param {string} text
 * @param {{ x: number, y: number, w: number, h: number, font_size: number }} cell
 */
export const draw_glyph = (ctx, text, cell) => {
  const { x, y, w, h } = cell
  if (LINES[text]) {
    draw_lines(ctx, LINES[text], cell)
    return true
  }
  const code = text.codePointAt(0) ?? 0
  if (text.length !== 1) return false
  if (code >= LOWER_START && code <= LOWER_END) {
    const fill = Math.round(((code - LOWER_START + 1) / EIGHTHS) * h)
    ctx.fillRect(x, y + h - fill, w, fill)
    return true
  }
  if (code >= LEFT_START && code <= LEFT_END) {
    const fill = Math.round(((LEFT_END - code + 1) / EIGHTHS) * w)
    ctx.fillRect(x, y, fill, h)
    return true
  }
  if (code >= BRAILLE_START && code <= BRAILLE_END) {
    draw_braille(ctx, code - BRAILLE_START, cell)
    return true
  }
  return false
}
