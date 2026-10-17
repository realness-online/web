import { stripVTControlCharacters as strip_vt } from 'node:util'

const BRAILLE = 0x2800
const CELL_X = 2
const CELL_Y = 4
const EIGHTHS = 8
const BOX_SIDES = 4
/** Braille dot bits by row then column, per Unicode's 8-dot pattern order. */
const DOTS = [...'03142567'].reduce(
  (rows, bit, at) => {
    rows[Math.floor(at / CELL_X)].push(1 << Number(bit))
    return rows
  },
  Array.from({ length: CELL_Y }, () => /** @type {number[]} */ ([]))
)
const PARTS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
const FULL = '█'
const EMPTY = '·'

/**
 * Sample `values` at `count` evenly spaced points with linear interpolation.
 * @param {number[]} values
 * @param {number} count
 */
const resample = (values, count) => {
  if (values.length === 1) return Array(count).fill(values[0])
  return Array.from({ length: count }, (_, at) => {
    const position = (at / Math.max(1, count - 1)) * (values.length - 1)
    const low = Math.floor(position)
    const high = Math.min(values.length - 1, low + 1)
    return values[low] + (values[high] - values[low]) * (position - low)
  })
}

/**
 * A connected line plot drawn in Braille cells, two dots wide and four tall.
 * Rows run top to bottom; the lowest value sits on the bottom dot row.
 * @param {number[]} values
 * @param {number} width cells
 * @param {number} height cells
 * @returns {string[]}
 */
export const braille_line = (values, width, height) => {
  const cells = Math.max(1, width)
  const rows = Math.max(1, height)
  if (!values.length) return Array(rows).fill(' '.repeat(cells))
  const dots_x = cells * CELL_X
  const dots_y = rows * CELL_Y
  const low = Math.min(...values)
  const span = Math.max(...values) - low
  const ys = resample(values, dots_x).map(value =>
    span === 0
      ? dots_y - 1
      : Math.round((1 - (value - low) / span) * (dots_y - 1))
  )
  const grid = Array.from({ length: rows }, () => Array(cells).fill(0))
  const set = (x, y) => {
    grid[Math.floor(y / CELL_Y)][Math.floor(x / CELL_X)] |=
      DOTS[y % CELL_Y][x % CELL_X]
  }
  ys.forEach((y, x) => {
    const previous = x ? ys[x - 1] : y
    for (let at = Math.min(y, previous); at <= Math.max(y, previous); at++)
      set(x, at)
  })
  return grid.map(row =>
    row.map(bits => String.fromCodePoint(BRAILLE + bits)).join('')
  )
}

/**
 * A horizontal meter in eighth-cell blocks; the unfilled track is dotted.
 * @param {number} fraction 0 to 1; values outside are clamped
 * @param {number} width cells
 */
export const meter = (fraction, width) => {
  const cells = Math.max(1, width)
  const share = Math.min(1, Math.max(0, Number(fraction) || 0))
  const eighths = Math.round(share * cells * EIGHTHS)
  const whole = Math.floor(eighths / EIGHTHS)
  const part = PARTS[eighths % EIGHTHS]
  return `${FULL.repeat(whole)}${part}${EMPTY.repeat(cells - whole - (part ? 1 : 0))}`
}

const SPARKS = '▁▂▃▄▅▆▇█'

/**
 * One-row trend in eighth-height blocks from a zero baseline, stretched or
 * resampled to exactly `width` cells.
 * @param {number[]} values
 * @param {number} width
 */
export const sparkline = (values, width) => {
  if (!values.length) return ''
  const room = Number.isFinite(width) ? Math.max(1, width) : values.length
  const points =
    values.length > room
      ? resample(values, room)
      : Array.from(
          { length: room },
          (_, at) => values[Math.floor((at * values.length) / room)]
        )
  const low = Math.min(0, ...points)
  const span = Math.max(...points) - low
  return points
    .map(
      value =>
        SPARKS[
          span === 0
            ? 0
            : Math.round(((value - low) / span) * (SPARKS.length - 1))
        ]
    )
    .join('')
}

const visible = text => [...strip_vt(text)].length

const cut = (text, width) =>
  visible(text) <= width
    ? text
    : `${[...strip_vt(text)].slice(0, Math.max(0, width - 1)).join('')}…`

/**
 * A rounded panel exactly `width` by `height` cells, title in the top edge.
 * Rows past the inner height are dropped; short panels are padded.
 * @param {object} options
 * @param {string} options.title
 * @param {string[]} options.lines
 * @param {number} options.width
 * @param {number} options.height
 * @param {(text: string) => string} [options.edge] paints border characters
 * @param {(text: string) => string} [options.label] paints the title
 */
export const panel_box = ({
  title,
  lines,
  width,
  height,
  edge = text => text,
  label = text => text
}) => {
  const inner = Math.max(1, width - BOX_SIDES)
  const room = Math.max(0, width - BOX_SIDES - 1)
  const name = cut(title, room)
  const top = `${edge('╭─ ')}${label(name)}${edge(` ${'─'.repeat(Math.max(0, width - visible(name) - BOX_SIDES - 1))}╮`)}`
  const rows = lines.slice(0, Math.max(0, height - 2))
  while (rows.length < height - 2) rows.push('')
  return [
    top,
    ...rows.map(row => {
      const text = cut(row, inner)
      return `${edge('│')} ${text}${' '.repeat(Math.max(0, inner - visible(text)))} ${edge('│')}`
    }),
    edge(`╰${'─'.repeat(Math.max(0, width - 2))}╯`)
  ].slice(0, Math.max(0, height))
}

/**
 * Stack each column's panels, then join the columns row by row.
 * @param {string[][]} columns rows per column, each already its column width
 */
export const side_by_side = columns => {
  const height = Math.max(0, ...columns.map(column => column.length))
  return Array.from({ length: height }, (_, at) =>
    columns.map(column => column[at] ?? '').join('')
  )
}

/**
 * The first variant that fits `width`, longest wording first; the last
 * variant is used when none fit, and the panel clips it.
 * @param {string[]} variants may carry color escapes
 * @param {number} width
 */
export const fit_first = (variants, width) =>
  variants.find(text => visible(text) <= width) ?? variants.at(-1) ?? ''

/** Widest visible line, ignoring color escapes. */
export const widest = lines => Math.max(0, ...lines.map(visible))

/**
 * Join parts with `gap`, starting a new line when the next part would pass `width`.
 * @param {string[]} parts may carry color escapes
 * @param {number} width
 * @param {string} [gap]
 * @returns {string[]}
 */
export const pack = (parts, width, gap = '  ') =>
  parts.reduce((lines, part) => {
    const last = lines.at(-1)
    if (last !== undefined && visible(last + gap + part) <= width)
      lines[lines.length - 1] = last + gap + part
    else lines.push(part)
    return lines
  }, /** @type {string[]} */ ([]))
