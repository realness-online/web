/** @type {readonly ['posters', 'thoughts', 'relations', 'me', 'person', 'shadows', 'sediment', 'sand', 'gravel', 'rocks', 'boulders']} */
export const types = [
  'posters',
  'thoughts',
  'relations',
  'me',
  'person',
  'shadows',
  'sediment',
  'sand',
  'gravel',
  'rocks',
  'boulders'
]

/** @typedef {typeof types[number]} Type */

/** @type {readonly ['posters']} */
export const has_archive = /** @type {readonly ['posters']} */ (
  /** @type {unknown} */ (types.slice(0, 1))
)

/** @type {readonly ['thoughts']} */
export const has_history = /** @type {readonly ['thoughts']} */ (
  /** @type {unknown} */ (types.slice(1, 2))
)

/** Types whose itemid must carry a created-at timestamp. @type {readonly ['posters']} */
export const requires_timestamp = ['posters']
