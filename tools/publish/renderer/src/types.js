/**
 * @typedef {object} PageMetadata
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [type]
 */

/**
 * @typedef {object} Site
 * @property {'blog'|'plans'} [type]
 * @property {string} name
 * @property {string} [tagline]
 * @property {string} [description]
 * @property {string} url
 * @property {string} poster
 * @property {string} [head] Author-controlled HTML.
 * @property {string} [back_label]
 * @property {Object<string, PageMetadata>} [pages]
 */

/**
 * @typedef {object} Article
 * @property {string} slug
 * @property {string} title
 * @property {boolean} draft
 * @property {string} [date]
 * @property {string} [img]
 * @property {string} [focus]
 * @property {string} [html] Absent for an omitted draft.
 * @property {string} [notes]
 * @property {number} [updated]
 */

/**
 * @typedef {object} PosterMetadata
 * @property {string} [img]
 * @property {string} [focus]
 * @property {string} [date]
 * @property {boolean|string} [draft]
 */

/**
 * @typedef {object} PosterSize
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} PagePreview
 * @property {boolean} [root]
 * @property {string} [description]
 * @property {string} [url]
 * @property {string} [type]
 * @property {string} [og_image_path]
 */

/**
 * @typedef {object} SitemapEntry
 * @property {string} loc
 * @property {string} [lastmod]
 */

export {}
