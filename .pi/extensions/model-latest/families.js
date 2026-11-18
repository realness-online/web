/**
 * Model families: a model id without its version numbers, and the newest id of each.
 */
const version_token = /^\d+(\.\d+)*$/

/**
 * Family and version of a model id, or null when the id is no plain release.
 * @param {string} id
 * @returns {{ family: string, version: number[] } | null}
 */
export const parse_id = id => {
  if (/[:~]|preview|latest|snapshot/.test(id)) return null
  const tokens = id.split('-')
  const numbers = tokens.filter(token => version_token.test(token))
  if (!numbers.length || numbers.some(token => token.length >= 4)) return null
  const family = tokens.filter(token => !version_token.test(token)).join('-')
  if (!family) return null
  return { family, version: numbers.flatMap(token => token.split('.').map(Number)) }
}

/**
 * Positive when version a is newer than version b.
 * @param {number[]} a
 * @param {number[]} b
 */
export const compare_versions = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0)
    if (difference) return difference
  }
  return 0
}

/**
 * The newest model id of each family with two or more versions.
 * @param {string[]} ids
 * @returns {Map<string, string>} family to newest id
 */
export const newest_by_family = ids => {
  /** @type {Map<string, { id: string, version: number[], count: number }>} */
  const families = new Map()
  for (const id of ids) {
    const parsed = parse_id(id)
    if (!parsed) continue
    const known = families.get(parsed.family)
    if (!known) families.set(parsed.family, { id, version: parsed.version, count: 1 })
    else {
      known.count++
      if (compare_versions(parsed.version, known.version) > 0) Object.assign(known, { id, version: parsed.version })
    }
  }
  return new Map(
    [...families].filter(([, entry]) => entry.count > 1).map(([family, entry]) => [`${family}-latest`, entry.id])
  )
}
