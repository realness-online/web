import { shell } from './templates/shell.js'
import { poster } from './templates/figure.js'
import { article_body, related_nav } from './templates/article.js'
import { index_body } from './templates/index.js'
import { sitemap } from './templates/sitemap.js'

/** @typedef {ReturnType<typeof create_templates>} Templates */

/**
 * Bind one build's settings and image dimensions to the templates.
 * @param {import('./types.js').Site} site
 * @param {Object<string, import('./types.js').PosterSize>} poster_sizes
 * @param {boolean} [watch=false]
 */
export const create_templates = (site, poster_sizes, watch = false) => {
  site = { name: '', tagline: '', description: '', url: '', ...site }
  const render_poster = (...args) => poster(site, poster_sizes, ...args)
  return {
    /**
     * @param {string} title
     * @param {string} body Rendered HTML.
     * @param {import('./types.js').PagePreview} [meta]
     */
    shell(title, body, meta) {
      return shell(site, title, body, meta, watch)
    },
    poster(...args) {
      return render_poster(...args)
    },
    related_nav(...args) {
      return related_nav(...args)
    },
    article_body(...args) {
      return article_body(render_poster, ...args)
    },
    /** @param {import('./types.js').Article[]} articles */
    index_body(articles) {
      return index_body(render_poster, site.type === 'plans', articles)
    },
    /** @param {import('./types.js').SitemapEntry[]} urls */
    sitemap(urls) {
      return sitemap(site, urls)
    },
  }
}
