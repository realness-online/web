/** @param {string} value */
export const escape_attr = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

const ISO_DATE_LENGTH = 10

/**
 * @param {string} route
 * @returns {string}
 */
export const prerender_dir_for_route = route => route.replace(/^\//, '')

/**
 * @param {string} html
 * @param {RegExp} pattern
 * @param {string} tag
 */
const replace_or_insert = (html, pattern, tag) => {
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

/**
 * @param {string} html
 * @param {{ title?: string, description?: string, og_title?: string, og_description?: string, og_url?: string, og_image?: string, og_image_alt?: string, og_image_type?: string, og_image_width?: number, og_image_height?: number, og_site_name?: string, twitter_title?: string, twitter_description?: string, twitter_image?: string, twitter_image_alt?: string, canonical?: string, robots?: string }} meta
 * @returns {string}
 */
export const apply_page_meta = (html, meta) => {
  let out = html
  if (meta.title)
    out = out.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escape_attr(meta.title)}</title>`
    )
  if (meta.description) {
    const tag = `<meta name="description" content="${escape_attr(meta.description)}" />`
    out = out.replace(/<meta\s+name="description"[\s\S]*?\/>/i, tag)
  }
  if (meta.robots) {
    const tag = `<meta name="robots" content="${escape_attr(meta.robots)}" />`
    out = replace_or_insert(out, /<meta name="robots"[\s\S]*?\/>/i, tag)
  }
  if (meta.og_title) {
    const tag = `<meta property="og:title" content="${escape_attr(meta.og_title)}" />`
    out = replace_or_insert(out, /<meta property="og:title"[\s\S]*?\/>/i, tag)
  }
  if (meta.og_description) {
    const tag = `<meta property="og:description" content="${escape_attr(meta.og_description)}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:description"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.og_url) {
    const tag = `<meta property="og:url" content="${escape_attr(meta.og_url)}" />`
    out = out.replace(/<meta property="og:url"[\s\S]*?\/>/i, tag)
  }
  if (meta.og_image) {
    const tag = `<meta property="og:image" content="${escape_attr(meta.og_image)}" />`
    out = replace_or_insert(out, /<meta property="og:image"[\s\S]*?\/>/i, tag)
  }
  if (meta.og_image_width) {
    const tag = `<meta property="og:image:width" content="${escape_attr(String(meta.og_image_width))}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:image:width"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.og_image_height) {
    const tag = `<meta property="og:image:height" content="${escape_attr(String(meta.og_image_height))}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:image:height"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.og_image_type) {
    const tag = `<meta property="og:image:type" content="${escape_attr(meta.og_image_type)}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:image:type"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.og_image_alt) {
    const tag = `<meta property="og:image:alt" content="${escape_attr(meta.og_image_alt)}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:image:alt"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.og_site_name) {
    const tag = `<meta property="og:site_name" content="${escape_attr(meta.og_site_name)}" />`
    out = replace_or_insert(
      out,
      /<meta property="og:site_name"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.twitter_title) {
    const tag = `<meta name="twitter:title" content="${escape_attr(meta.twitter_title)}" />`
    out = replace_or_insert(out, /<meta name="twitter:title"[\s\S]*?\/>/i, tag)
  }
  if (meta.twitter_description) {
    const tag = `<meta name="twitter:description" content="${escape_attr(meta.twitter_description)}" />`
    out = replace_or_insert(
      out,
      /<meta name="twitter:description"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.twitter_image) {
    const tag = `<meta name="twitter:image" content="${escape_attr(meta.twitter_image)}" />`
    out = replace_or_insert(out, /<meta name="twitter:image"[\s\S]*?\/>/i, tag)
  }
  if (meta.twitter_image_alt) {
    const tag = `<meta name="twitter:image:alt" content="${escape_attr(meta.twitter_image_alt)}" />`
    out = replace_or_insert(
      out,
      /<meta name="twitter:image:alt"[\s\S]*?\/>/i,
      tag
    )
  }
  if (meta.canonical) {
    const tag = `<link rel="canonical" href="${escape_attr(meta.canonical)}" />`
    if (/<link rel="canonical"/i.test(out))
      out = out.replace(/<link rel="canonical"[\s\S]*?\/?>/i, tag)
    else out = out.replace('</head>', `    ${tag}\n  </head>`)
  }
  return out
}

/**
 * @param {string} html
 * @param {Record<string, unknown>} data
 */
export const inject_json_ld = (html, data) => {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  const tag = `<script type="application/ld+json">${json}</script>`
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

/**
 * @param {{ site_origin: string, pages: Array<{ path: string }>, lastmod?: string, extra_urls?: string[] }} options
 * @returns {string}
 */
export const build_sitemap_xml = ({
  site_origin,
  pages,
  lastmod = new Date().toISOString().slice(0, ISO_DATE_LENGTH),
  extra_urls = []
}) => {
  const urls = [
    ...pages.map(page => `${site_origin}${page.path}`),
    ...extra_urls.map(path =>
      path.startsWith('http') ? path : `${site_origin}${path}`
    )
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(loc => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`
}

/**
 * @param {string} template
 * @param {string} app_html
 * @returns {string}
 */
export const inject_app_html = (template, app_html) =>
  template.replace(
    /<div id="app">[\s\S]*?<\/div>/,
    `<div id="app" data-prerender="true">${app_html}</div>`
  )
