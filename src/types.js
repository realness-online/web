/** @typedef {string | SVGPathElement} Path */
/** @typedef {string | SVGRectElement} Rect */

/** @typedef {string} Author */
/** @typedef {number} Created */

/**
 * @typedef {`${Author}/${Type}/${Created}` | `${Author}/${Type}/${Created}/shadow` | `${Author}/${Type}/${Created}/sediment` | `${Author}/${Type}/${Created}/sand` | `${Author}/${Type}/${Created}/gravel` | `${Author}/${Type}/${Created}/rock` | `${Author}/${Type}/${Created}/boulder`} Id
 */

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
 * @typedef {Object} Cutout
 * @property {string} d - SVG path data
 * @property {string} fill - Fill color
 * @property {string|null|undefined} transform - SVG transform attribute
 * @property {string} [fill-opacity] - Fill opacity
 * @property {number} [data-progress] - Progress bucket value
 */

/**
 * @typedef {Object} Poster
 * @property {Id} id
 * @property {Rect} background
 * @property {Path} light
 * @property {Path} regular
 * @property {Path} medium
 * @property {Path} bold
 * @property {Path[] | Path} cutout
 * @property {number} width
 * @property {number} height
 * @property {string} viewbox
 * @property {boolean} optimized
 * @property {Object} [trace] - Traced paths with color quantization
 * @property {Array<{d: string, fill: string, stroke: string, stroke_width: number}>} trace.paths
 */

/**
 * @typedef {Object} PersonQuery
 * @property {Id} id
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
 * @property {string} name
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

/**
 * @typedef {Object} Available_Command
 * @property {string} key - Normalized key combination
 * @property {string} command - Command identifier
 * @property {Object} parameters - Command parameters
 * @property {string} context - Context name
 */

/**
 * @typedef {Object} Toc_Item
 * @property {string} id - Section ID
 * @property {string} title - Section title
 * @property {number} level - Heading level (2-6)
 */

/**
 * @typedef {Object} Content_File
 * @property {string} name - File name without extension
 * @property {string} title - Display title
 * @property {string} content - Markdown content
 */

/**
 * @typedef {Object} Key_Binding
 * @property {string} key - Key combination (e.g., "ctrl+s", "enter", "f")
 * @property {string|Array} command - Command to execute, optionally with parameters
 * @property {string} [description] - Human-readable description of the command
 */

/**
 * @typedef {Object} Keymap_Context
 * @property {string} [context] - Context identifier (e.g., "Editor", "PosterMenu")
 * @property {boolean} use_key_equivalents - Use platform-specific key equivalents
 * @property {Object.<string, string|Array>} bindings - Key to command mappings
 * @property {Object.<string, string>} [descriptions] - Command descriptions for this context
 */

export {}
