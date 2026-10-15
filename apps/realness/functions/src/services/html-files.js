/**
 * The HTML objects in a listing; `.html` is the only stored name.
 * @param {Array<{name: string}>} files
 * @returns {Array<{name: string}>}
 */
export const unique_html_files = files =>
  files.filter(file => file.name.endsWith('.html'))
