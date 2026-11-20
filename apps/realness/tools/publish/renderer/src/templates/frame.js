import { escape_html } from '../text.js'

/**
 * A page with the palette and the note's own head, and no site chrome.
 * @param {import('../types.js').Site} site
 * @param {string} title
 * @param {string} body Rendered HTML.
 * @param {import('../types.js').PagePreview} [meta]
 * @param {{ stylesheets?: string[], scripts?: string[], watch?: boolean }} [options] extra links, and live reload
 */
export const frame = (site, title, body, meta = {}, options = {}) => {
  const { stylesheets = [], scripts = [], watch = false } = options
  const links = stylesheets
    .map(href => `\n    <link rel="stylesheet" href="${escape_html(href)}">`)
    .join('')
  const modules = scripts
    .map(
      src => `\n    <script type="module" src="${escape_html(src)}"></script>`
    )
    .join('')
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape_html(`${title} — ${site.name}`)}</title>
    <meta name="description" content="${escape_html(meta.description || site.description)}">
    <link rel="canonical" href="${escape_html(`${site.url}${meta.url ?? ''}`)}">
    <link rel="stylesheet" href="/palette.css">
    <link rel="stylesheet" href="/color.css">
    <link rel="stylesheet" href="/font.css">
    <link rel="stylesheet" href="/style.css">${links}
    <link rel="icon" type="image/svg+xml" href="/icons.svg">${modules}${site.pwa ? `\n    <link rel="manifest" href="/manifest.webmanifest">\n    <script type="module" src="/scripts/pwa.js"></script>` : ''}${meta.head ? `\n    ${meta.head}` : ''}${watch ? '\n    <script type="module" src="/scripts/live-reload.js"></script>' : ''}
  </head>
  <body>
  <main>
    ${body}
  </main>
  </body>
  </html>`
}
