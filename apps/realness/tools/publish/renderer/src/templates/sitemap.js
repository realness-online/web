import { escape_html } from '../text.js'

export const sitemap = (site, urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      u => `  <url>
      <loc>${escape_html(`${site.url}${u.loc}`)}</loc>${u.lastmod ? `\n    <lastmod>${escape_html(u.lastmod.split('T')[0])}</lastmod>` : ''}
    </url>`
    )
    .join('\n')}
  </urlset>
  `
