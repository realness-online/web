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
  const settings = {
    tagline: '',
    description: '',
    ...site
  }
  /**
   * The poster helper the article and index bodies call, with this build's
   * settings and sizes already bound.
   * @param {{ itemid?: string, img?: string, focus?: string, draft?: boolean }} data front matter
   * @param {string} title
   * @param {'h1' | 'h2'} [heading]
   * @param {string | null} [href]
   * @param {object} [options]
   */
  const render_poster = (data, title, heading, href, options) =>
    poster(settings, poster_sizes, data, title, heading, href, options)
  return {
    /**
     * @param {string} title
     * @param {string} body Rendered HTML.
     * @param {import('./types.js').PagePreview} [meta]
     */
    shell(title, body, meta) {
      return shell(settings, title, body, meta, watch)
    },
    poster: render_poster,
    render_poster,
    /**
     * @param {{ title: string, href: string }[] | undefined} links
     * @param {string} current
     */
    related_nav(links, current) {
      return related_nav(links, current)
    },
    /**
     * @param {{ itemid?: string }} data front matter
     * @param {string} title
     * @param {string} html
     * @param {string} notes
     * @param {string} [related]
     */
    article_body(data, title, html, notes, related) {
      return article_body(render_poster, data, title, html, notes, related)
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
