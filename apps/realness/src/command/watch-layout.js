const SMALL_WIDTH = 90
const SMALL_HEIGHT = 18
const WIDE_WIDTH = 180
const BORDER_ROWS = 2

/**
 * The layout a terminal gets. A cell is about twice as tall as it is wide,
 * so a screen with half as many rows as columns is square.
 * @param {number} width columns
 * @param {number} height rows
 * @returns {'small' | 'medium' | 'tall' | 'wide'}
 */
export const size_class = (width, height) => {
  if (width < SMALL_WIDTH || height < SMALL_HEIGHT) return 'small'
  if (width >= WIDE_WIDTH) return 'wide'
  if (height * 2 >= width) return 'tall'
  return 'medium'
}

/**
 * @typedef {object} Box
 * @property {string} name
 * @property {string} title
 * @property {string[]} lines the rows at the box's smallest size
 * @property {(extra: number) => string[]} [grow] the rows with `extra` more
 * @property {number} [max] the tallest the box grows, borders included
 */

/**
 * The boxes a column shows, in the order given, each with its height. Room
 * goes to the box named first in `priority`; a box that does not fit whole
 * is left out. Spare rows grow a box that can grow, then the last box.
 * @param {Box[]} boxes
 * @param {number} height rows
 * @param {string[]} priority box names, most important first
 * @returns {(Box & { height: number })[]}
 */
export const stack = (boxes, height, priority) => {
  const rank = box => {
    const at = priority.indexOf(box.name)
    return at < 0 ? priority.length : at
  }
  const ordered = boxes.toSorted((a, b) => rank(a) - rank(b))
  let spare = height
  const kept = new Map()
  for (const box of ordered) {
    const need = box.lines.length + BORDER_ROWS
    if (need > spare) continue
    kept.set(box, { ...box })
    spare -= need
  }
  for (const [box, sized] of kept) {
    if (!box.grow) continue
    const need = sized.lines.length + BORDER_ROWS
    const extra = Math.max(0, Math.min(spare, (box.max ?? Infinity) - need))
    if (!extra) continue
    sized.lines = box.grow(extra)
    spare -= extra
  }
  return boxes
    .filter(box => kept.has(box))
    .map(box => ({
      ...kept.get(box),
      height: kept.get(box).lines.length + BORDER_ROWS
    }))
}
