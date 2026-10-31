/**
 * Split panes as a tree, like Ghostty: a leaf is one shell session, a split
 * holds two children side by side (`row`) or stacked (`column`). Splitting
 * a pane replaces its leaf with a split of the old pane and the new one.
 *
 * The page keeps panes as one flat list of elements and places each from
 * `places`, so a split never remounts a running terminal.
 *
 * @typedef {{ session: string | null }} Leaf
 * @typedef {{ split: 'row' | 'column', a: Node, b: Node }} Split
 * @typedef {Leaf | Split} Node
 * @typedef {{ top: number, left: number, width: number, height: number }} Place
 */

export const MAX_PANES = 4
const DIRECTIONS = new Set(['row', 'column'])

/**
 * @param {Node} node
 * @returns {node is Leaf}
 */
const is_leaf = node => !('split' in node)

/** Sessions in reading order: left before right, top before bottom. @param {Node} node @returns {Array<string | null>} */
export const sessions = node =>
  is_leaf(node) ? [node.session] : [...sessions(node.a), ...sessions(node.b)]

/**
 * The tree with `session`'s pane split in `direction`, the new pane after it.
 * @param {Node} node
 * @param {string | null} session
 * @param {'row' | 'column'} direction
 * @param {string} fresh
 * @returns {Node}
 */
export const split_at = (node, session, direction, fresh) => {
  if (is_leaf(node))
    return node.session === session
      ? { split: direction, a: node, b: { session: fresh } }
      : node
  return {
    ...node,
    a: split_at(node.a, session, direction, fresh),
    b: split_at(node.b, session, direction, fresh)
  }
}

/**
 * The tree without `session`'s pane; its sibling takes the space.
 * @param {Node} node
 * @param {string | null} session
 * @returns {Node}
 */
export const remove_pane = (node, session) => {
  if (is_leaf(node)) return node
  if (is_leaf(node.a) && node.a.session === session) return node.b
  if (is_leaf(node.b) && node.b.session === session) return node.a
  return {
    ...node,
    a: remove_pane(node.a, session),
    b: remove_pane(node.b, session)
  }
}

/**
 * Each pane's box, in percent of the whole; halves at every split.
 * @param {Node} node
 * @param {Place} [box]
 * @param {Map<string | null, Place>} [found]
 */
export const places = (
  node,
  box = { top: 0, left: 0, width: 100, height: 100 },
  found = new Map()
) => {
  if (is_leaf(node)) return found.set(node.session, box)
  const across = node.split === 'row'
  const half = across ? box.width / 2 : box.height / 2
  places(
    node.a,
    across ? { ...box, width: half } : { ...box, height: half },
    found
  )
  places(
    node.b,
    across
      ? { ...box, left: box.left + half, width: half }
      : { ...box, top: box.top + half, height: half },
    found
  )
  return found
}

/**
 * The pane beside `session` on `side`, the nearest one that overlaps it, or
 * undefined at the edge.
 * @param {Node} node
 * @param {string | null} session
 * @param {'left' | 'right' | 'up' | 'down'} side
 */
export const toward = (node, session, side) => {
  const at = places(node)
  const from = at.get(session)
  if (!from) return undefined
  const across = side === 'left' || side === 'right'
  const overlaps = box =>
    across
      ? box.top < from.top + from.height && from.top < box.top + box.height
      : box.left < from.left + from.width && from.left < box.left + box.width
  const gap = box =>
    ({
      left: from.left - (box.left + box.width),
      right: box.left - (from.left + from.width),
      up: from.top - (box.top + box.height),
      down: box.top - (from.top + from.height)
    })[side]
  let best
  let nearest = Infinity
  for (const [other, box] of at) {
    if (other === session || !overlaps(box) || gap(box) < 0) continue
    if (gap(box) < nearest) [best, nearest] = [other, gap(box)]
  }
  return best
}

/**
 * @param {any} node
 * @returns {node is Node}
 */
const valid = node => {
  if (!node || typeof node !== 'object') return false
  if ('split' in node)
    return DIRECTIONS.has(node.split) && valid(node.a) && valid(node.b)
  return node.session === null || typeof node.session === 'string'
}

/**
 * The tree a saved layout describes, or one pane when it cannot be trusted.
 * An older page saved a flat list and one direction; that becomes a chain.
 * @param {any} layout
 * @returns {Node}
 */
export const from_saved = layout => {
  const one = { session: null }
  if (valid(layout?.tree)) {
    const listed = sessions(layout.tree)
    if (
      listed.length <= MAX_PANES &&
      listed.includes(null) &&
      new Set(listed).size === listed.length
    )
      return layout.tree
    return one
  }
  const saved = Array.isArray(layout?.panes) ? layout.panes : []
  if (!saved.length || saved.length > MAX_PANES || saved[0]?.session !== null)
    return one
  const direction = layout.direction === 'column' ? 'column' : 'row'
  return saved.slice(1).reduce(
    (tree, { session }) => ({
      split: direction,
      a: tree,
      b: { session: session ?? null }
    }),
    /** @type {Node} */ (one)
  )
}
