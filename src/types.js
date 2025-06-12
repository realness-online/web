/** @typedef {string | SVGPathElement} Path */
/** @typedef {string | SVGRectElement} Rect */

/** @typedef {string} Author */
/** @typedef {number} Created */

/** @typedef {`${Author}/${Type}/${Created}`} Id */

/**
 * @typedef {Object} rgba_color
 * @property {number} r
 * @property {number} g
 * @property {number} b
 * @property {number} a
 */

/**
 * @typedef {Object} Item
 * @property {Id} id
 * @property {Type} type
 */

/**
 * @typedef {Object} Poster
 * @property {Id} id
 * @property {Rect} background
 * @property {Path} light
 * @property {Path} regular
 * @property {Path} medium
 * @property {Path} bold
 * @property {number} width
 * @property {number} height
 * @property {string} viewbox
 * @property {Object} [trace] - Traced paths with color quantization
 * @property {Array<{d: string, fill: string, stroke: string, stroke_width: number}>} trace.paths
 */

/**
 * @typedef {Object} Relation
 * @property {Id} id
 * @property {string} type
 * @property {string} name
 * @property {string} avatar
 * @property {string[]} viewed
 * @property {`${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`} visited - ISO 8601 UTC date string
 */

/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} [avatar]
 * @property {`${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`} [visited] - ISO 8601 UTC date string
 */

/** @type {readonly ['posters', 'statements', 'events', 'relations', 'me', 'person']} */
export const types = [
  'posters',
  'statements',
  'events',
  'relations',
  'me',
  'person'
]

/** @typedef {typeof types[number]} Type */

/** @type {readonly ['posters']} */
export const has_archive = /** @type {Type[]} */ (types.slice(0, 1))

/** @type {readonly ['statements', 'events']} */
export const has_history = /** @type {Type[]} */ (types.slice(1, 3))

export {}
