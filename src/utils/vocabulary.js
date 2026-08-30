// Microdata requires `itemtype` to be an absolute URL, so Realness publishes its
// own vocabulary under its own origin. Selectors match on the trailing segment
// (`[itemtype$='/posters']`) so posters saved before this still read.
export const VOCABULARY = 'https://realness.online'

/**
 * Trailing segment of an `itemtype`, for both `https://realness.online/posters`
 * and the relative `/posters` written by older saves.
 * @param {string | null} itemtype
 * @returns {string | null}
 */
export const as_vocabulary_type = itemtype => {
  if (!itemtype) return null
  return itemtype.split('/').pop() || null
}
