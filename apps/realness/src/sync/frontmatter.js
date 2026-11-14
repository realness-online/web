/**
 * A note's frontmatter, read without a YAML dependency. The shapes our notes
 * write are all it takes: `key: value`, quotes of either kind or none, and a
 * `key:` block of `- title: ... / href: ...` maps.
 */

/**
 * The frontmatter text and the body after it. Frontmatter counts only at the
 * very start of a note.
 * @param {string} raw a note's whole text
 * @returns {{ front: string, body: string }}
 */
export const split_frontmatter = raw => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  return match
    ? { front: match[1], body: raw.slice(match[0].length) }
    : { front: '', body: raw }
}

/**
 * One scalar as the note wrote it: single quoted, double quoted, or bare.
 * @param {string} text
 * @returns {string}
 */
const scalar = text => {
  const value = text.trim()
  const quoted = /^(["'])([\s\S]*)\1$/.exec(value)
  return quoted ? quoted[2] : value
}

/**
 * The keys a note's frontmatter names, each a string or a list of maps.
 * @param {string} front the frontmatter, without its `---` lines
 * @returns {Record<string, string | Record<string, string>[]>}
 */
export const frontmatter_data = front => {
  /** @type {Record<string, string | Record<string, string>[]>} */
  const data = {}
  /** @type {Record<string, string>[] | null} */
  let list = null
  for (const line of front.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const entry = /^\s*-\s+([\w-]+):\s*(.*)$/.exec(line)
    if (entry && list) {
      list.push({ [entry[1]]: scalar(entry[2]) })
      continue
    }
    const key = /^\s*([\w-]+):\s*(.*)$/.exec(line)
    if (!key) continue
    const last = list?.at(-1)
    if (last && /^\s/.test(line)) {
      last[key[1]] = scalar(key[2])
      continue
    }
    if (key[2].trim()) {
      data[key[1]] = scalar(key[2])
      list = null
    } else {
      list = []
      data[key[1]] = list
    }
  }
  return data
}

/**
 * A note's frontmatter keys and its body, read in one pass.
 * @param {string} raw a note's whole text
 * @returns {{ data: Record<string, string | Record<string, string>[]>, body: string }}
 */
export const read_frontmatter = raw => {
  const { front, body } = split_frontmatter(raw)
  return { data: frontmatter_data(front), body }
}
