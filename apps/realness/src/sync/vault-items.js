/**
 * Vault answers as microdata pages: one item per plan or note, read in the
 * browser with `get_itemprops`.
 */
import { item_html } from '#root/lib/items.js'

/**
 * @param {import('./vault-plans.js').PlanSummary[]} plans
 * @returns {string}
 */
export const plans_html = plans =>
  plans
    .map(plan =>
      item_html('plan', {
        itemid: plan.itemid,
        path: plan.path,
        title: plan.title,
        area: plan.area,
        scout: plan.scout,
        archived: plan.archived,
        diagram: plan.diagram ?? '',
        nodes: plan.nodes
      })
    )
    .join('')

/**
 * One note: a whole page by itemid, or a file's text by path.
 * @param {{ path: string, text: string, title?: string, itemid?: string | null, layout?: string, created?: string, related?: { title: string, href: string }[], links?: Record<string, string> }} note
 * @returns {string}
 */
export const note_html = ({
  path,
  text,
  title = '',
  itemid = null,
  layout = '',
  created = '',
  related = [],
  links = {}
}) =>
  item_html('note', {
    itemid: itemid ?? '',
    path,
    title,
    ...(layout ? { layout, created } : {}),
    text,
    related,
    links: Object.entries(links).map(([href, to]) => ({ href, to }))
  })

/**
 * @param {{ path: string, title: string, text: string }[]} hits
 * @returns {string}
 */
export const hits_html = hits =>
  hits
    .map(({ path, title, text }) => item_html('hit', { path, title, text }))
    .join('')

/**
 * @param {import('./vault-articles.js').ArticleSummary[]} articles
 * @returns {string}
 */
export const articles_html = articles =>
  articles
    .map(({ itemid, path, title, created, description }) =>
      item_html('article', { itemid, path, title, created, description })
    )
    .join('')

/**
 * @param {import('./vault-pages.js').ToolPage[]} pages
 * @returns {string}
 */
export const pages_html = pages =>
  pages.map(({ title, path }) => item_html('page', { title, path })).join('')

/**
 * @param {{ path: string, name: string, kind: 'folder' | 'file', size: number, mtime_ms: number }[]} files
 * @returns {string}
 */
export const files_html = files =>
  files
    .map(({ path, name, kind, size, mtime_ms }) =>
      item_html('file', { path, name, kind, size, mtime_ms })
    )
    .join('')
