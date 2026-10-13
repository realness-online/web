/**
 * The other storage name during the filename transition.
 * Only person HTML items participate; unrelated files stay untouched.
 * @param {string} name
 * @returns {string | null}
 */
export const mirror_name = name => {
  if (!name.startsWith('people/')) return null
  if (name.endsWith('.html.gz')) return name.slice(0, -3)
  if (name.endsWith('.html')) return `${name}.gz`
  return null
}
