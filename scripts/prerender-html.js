/** @param {string} value */
export const escape_attr = value =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

/**
 * @param {string} route
 * @returns {string}
 */
export const prerender_dir_for_route = route => route.replace(/^\//, '')

/**
 * @param {string} html
 * @param {{ title?: string, description?: string, og_title?: string, og_url?: string, canonical?: string }} meta
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
  if (meta.og_title) {
    const tag = `<meta property="og:title" content="${escape_attr(meta.og_title)}" />`
    if (/<meta property="og:title"/i.test(out))
      out = out.replace(/<meta property="og:title"[\s\S]*?\/>/i, tag)
    else out = out.replace('</head>', `    ${tag}\n  </head>`)
  }
  if (meta.og_url) {
    const tag = `<meta property="og:url" content="${escape_attr(meta.og_url)}" />`
    out = out.replace(/<meta property="og:url"[\s\S]*?\/>/i, tag)
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
 * @param {string} template
 * @param {string} app_html
 * @returns {string}
 */
export const inject_app_html = (template, app_html) =>
  template.replace(
    /<div id="app">[\s\S]*?<\/div>/,
    `<div id="app" data-prerender="true">${app_html}</div>`
  )
