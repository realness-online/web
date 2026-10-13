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
