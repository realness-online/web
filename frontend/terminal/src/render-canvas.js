// Draw a libghostty-vt frame onto a 2D canvas. Browser and Node (OffscreenCanvas).

const LINE_HEIGHT = 1.4
const FONT_SIZE = 14
const SELECTION_OPACITY = 0.6
const PIXEL_CENTER = 0.5

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

export const cell_metrics = (ctx, font_size) => {
  ctx.font = `${font_size}px ${MONO}`
  const width = Math.ceil(ctx.measureText('M').width)
  const height = Math.ceil(font_size * LINE_HEIGHT)
  return { width, height }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} frame from Terminal.frame()
 * @param {{font_size?: number, dpr?: number}} [opts]
 */
export const draw_frame = (ctx, frame, opts = {}) => {
  const font_size = opts.font_size ?? FONT_SIZE
  const dpr = opts.dpr ?? (globalThis.devicePixelRatio || 1)
  const metrics = cell_metrics(ctx, font_size)
  const width = frame.cols * metrics.width
  const height = frame.rows * metrics.height

  if (ctx.canvas.width !== width * dpr) ctx.canvas.width = width * dpr
  if (ctx.canvas.height !== height * dpr) ctx.canvas.height = height * dpr
  // Backing store is dpr-scaled; CSS size stays logical so it is not 2x on retina.
  ctx.canvas.style.width = `${width}px`
  ctx.canvas.style.height = `${height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.textBaseline = 'top'

  ctx.fillStyle = rgb(frame.colors.background)
  ctx.fillRect(0, 0, width, height)

  const selection_fill = opts.selection_color
    ? `rgba(${opts.selection_color[0]}, ${opts.selection_color[1]}, ${opts.selection_color[2]}, 0.6)`
    : 'rgba(120, 160, 255, 0.35)'

  frame.rows_data.forEach((row, y) => {
    row.cells.forEach((cell, x) => {
      const px = x * metrics.width
      const py = y * metrics.height
      const f = cell.flags || {}
      let fg = cell.fg || frame.colors.foreground
      let bg = cell.bg || frame.colors.background
      if (f.inverse) [fg, bg] = [bg, fg]

      if (cell.bg || f.inverse) {
        ctx.fillStyle = rgb(bg)
        ctx.fillRect(px, py, metrics.width, metrics.height)
      }
      if (cell.selected) {
        ctx.fillStyle = selection_fill
        ctx.fillRect(px, py, metrics.width, metrics.height)
      }
      if (!cell.text) return
      ctx.font = `${f.italic ? 'italic ' : ''}${f.bold ? 'bold ' : ''}${font_size}px ${MONO}`
      ctx.fillStyle = rgb(fg)
      ctx.fillText(cell.text, px, py)
      if (f.underline)
        ctx.fillRect(px, py + metrics.height - 2, metrics.width, 1)
    })
  })

  draw_cursor(ctx, frame, metrics, opts.blink_on ?? true)

  return { metrics, width, height }
}

const draw_cursor = (ctx, frame, metrics, blink_on) => {
  const { cursor } = frame
  if (!cursor.visible || !cursor.viewport_has_value) return
  if (cursor.blinking && !blink_on) return
  const px = cursor.x * metrics.width
  const py = cursor.y * metrics.height
  ctx.fillStyle = rgb(frame.colors.cursor)
  switch (cursor.visual_style) {
    case 0: // bar
      ctx.fillRect(px, py, 2, metrics.height)
      break
    case 2: // underline
      ctx.fillRect(px, py + metrics.height - 2, metrics.width, 2)
      break
    case 3: // hollow block
      ctx.strokeStyle = rgb(frame.colors.cursor)
      ctx.strokeRect(
        px + PIXEL_CENTER,
        py + PIXEL_CENTER,
        metrics.width - 1,
        metrics.height - 1
      )
      break
    default: // block
      ctx.globalAlpha = SELECTION_OPACITY
      ctx.fillRect(px, py, metrics.width, metrics.height)
      ctx.globalAlpha = 1
  }
}

const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`
