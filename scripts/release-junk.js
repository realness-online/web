/** OS / tooling files that must not ship or be attested in release manifests. */

const junk_names = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  'Desktop.ini',
  '__MACOSX'
])

/**
 * True if any path segment is a dotfile/dir or a known junk name.
 * Matches Firebase Hosting ignore for dot paths, plus common non-dot junk.
 * @param {string} file_path URL or filesystem path
 */
export const is_release_junk = file_path => {
  const parts = file_path.replaceAll('\\', '/').split('/').filter(Boolean)
  return parts.some(part => part.startsWith('.') || junk_names.has(part))
}
