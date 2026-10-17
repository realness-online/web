import { escape_html } from '../text.js'
import { OG_WIDTH, OG_HEIGHT } from '../images.js'

/**
 * @param {import('../types.js').Site} site
 * @param {string} title
 * @param {string} body Rendered HTML.
 * @param {import('../types.js').PagePreview} [meta]
 * @param {boolean} [watch=false]
 */
export const shell = (site, title, body, meta = {}, watch = false) => {
    const plans = site.type === 'plans'
    const diagrams = body.includes('<pre class="mermaid">')
    const full_title = meta.root ? `${title} — ${site.tagline}` : `${title} — ${site.name}`
    const description = meta.description || site.description
    const canonical = `${site.url}${meta.url || ''}`
    const og_type = meta.type || 'website'
    const og_image = `${site.url}${meta.og_image_path}`
    return `<!doctype html>
  <html lang="en"${plans ? ' data-site="plans"' : ''}${diagrams ? ' data-diagrams="pending"' : ''}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">${site.head ? `\n  ${site.head}` : ''}
    <title>${escape_html(full_title)}</title>
    <meta name="description" content="${escape_html(description)}">
    <link rel="canonical" href="${escape_html(canonical)}">
    <meta property="og:site_name" content="${escape_html(site.name)}">
    <meta property="og:type" content="${escape_html(og_type)}">
    <meta property="og:title" content="${escape_html(full_title)}">
    <meta property="og:description" content="${escape_html(description)}">
    <meta property="og:url" content="${escape_html(canonical)}">
    <meta property="og:image" content="${escape_html(og_image)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="${OG_WIDTH}">
    <meta property="og:image:height" content="${OG_HEIGHT}">
    <meta property="og:image:alt" content="${escape_html(full_title)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escape_html(full_title)}">
    <meta name="twitter:description" content="${escape_html(description)}">
    <meta name="twitter:image" content="${escape_html(og_image)}">
    <meta name="twitter:image:alt" content="${escape_html(full_title)}">
    <link rel="stylesheet" href="/palette.css">
    <link rel="stylesheet" href="/color.css">
    <link rel="stylesheet" href="/font.css">
    <link rel="stylesheet" href="/style.css">${plans ? '\n  <link rel="stylesheet" href="/plans.css">' : ''}
    <link rel="icon" type="image/svg+xml" href="/icons.svg">
    <link rel="apple-touch-icon" href="/192.png">${site.pwa ? '\n    <link rel="manifest" href="/manifest.webmanifest">\n    <script type="module" src="/scripts/pwa.js"></script>' : ''}
    <script type="module" src="/scripts/detect.js"></script>
    <script type="module" src="/scripts/reveal.js"></script>
    ${plans ? '<script type="module" src="/scripts/plan-covers.js"></script>' : ''}
    <link rel="stylesheet" href="/scripts/diagrams.css">
    <script type="module" src="/scripts/diagrams.js"></script>
    ${watch ? '<script type="module" src="/scripts/live-reload.js"></script>' : ''}
  </head>
  <body>
  <main>
    <template src="/partials/header.fragment"></template>
    ${body}
    <template src="/partials/footer.fragment"></template>
  </main>
  </body>
  </html>`
  }
