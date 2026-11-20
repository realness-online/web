import { frame } from './templates/frame.js'
import { shell } from './templates/shell.js'

/** What each frame adds to the bare document: its stylesheet, and any script. */
const LAYOUTS = new Map([
  ['article', { stylesheets: ['/layouts/article.css'] }],
  ['canvas', { stylesheets: ['/layouts/canvas.css'] }],
  [
    'deck',
    { stylesheets: ['/layouts/deck.css'], scripts: ['/layouts/deck.js'] }
  ],
  ['print', { stylesheets: ['/layouts/print.css'] }]
])

/**
 * The page shell a note's `layout:` line names. A note with no line gets the
 * site's own shell.
 * @param {import('./types.js').Site} site
 * @param {string} title
 * @param {string} body Rendered HTML.
 * @param {import('./types.js').PagePreview} [meta] `layout` names the shell.
 * @param {boolean} [watch=false]
 */
export const layout_of = (site, title, body, meta = {}, watch = false) => {
  const name = meta.layout ?? 'app'
  if (name === 'app') return shell(site, title, body, meta, watch)
  const layout = LAYOUTS.get(name)
  if (!layout) throw new Error(`unsupported layout: ${name}`)
  return frame(site, title, body, meta, { ...layout, watch })
}
