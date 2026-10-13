/**
 * Read one object per logical HTML file during the two-name transition.
 * Legacy writers remain authoritative until the writer release, so prefer
 * their name when both exist. Keep listings stable regardless of order.
 * @param {Array<{name: string}>} files
 * @returns {Array<{name: string}>}
 */
export const unique_html_files = files => {
  const selected = new Map()
  for (const file of files) {
    if (!/\.html(?:\.gz)?$/.test(file.name)) continue
    const key = file.name.replace(/\.gz$/, '')
    if (!selected.has(key) || file.name.endsWith('.gz')) selected.set(key, file)
  }
  return [...selected.values()]
}
