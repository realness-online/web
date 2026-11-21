import { hydrate, get_itemprops } from '@/utils/item'

/**
 * A repeated property reads as a list, a single one as a value.
 * @param {unknown} value one item, several, or none
 * @returns {any[]}
 */
const list = value => {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Every `/type` item in a vault answer, as its properties.
 * @param {string} html
 * @param {string} type
 * @returns {Record<string, any>[]}
 */
const items_of = (html, type) =>
  Array.from(
    hydrate(html)?.querySelectorAll(`[itemtype="/${type}"]`) ?? []
  ).map(get_itemprops)

/**
 * The path one vault change names, `v1/vault/events`.
 * @param {string} html
 * @returns {string | undefined}
 */
export const read_change = html => items_of(html, 'change')[0]?.path

/**
 * The plan list, `v1/vault/projects`.
 * @param {string} html
 */
export const read_plans = html =>
  items_of(html, 'plan').map(plan => ({
    itemid: plan.itemid,
    path: plan.path,
    title: plan.title ?? '',
    area: plan.area ?? '',
    scout: plan.scout === 'true',
    archived: plan.archived === 'true',
    diagram: plan.diagram || null,
    nodes: {
      open: Number(plan.nodes?.open ?? 0),
      done: Number(plan.nodes?.done ?? 0),
      active: list(plan.nodes?.active),
      blocked: list(plan.nodes?.blocked)
    }
  }))

/**
 * The blog's articles, `v1/vault/articles`.
 * @param {string} html
 */
export const read_articles = html =>
  items_of(html, 'article').map(article => ({
    itemid: article.itemid,
    path: article.path,
    title: article.title ?? '',
    created: article.created ?? '',
    description: article.description ?? ''
  }))

/**
 * One note, `v1/vault/item` or `v1/vault/note`.
 * @param {string} html
 */
export const read_note = html => {
  const [note] = items_of(html, 'note')
  if (!note) return null
  return {
    itemid: note.itemid || null,
    path: note.path,
    title: note.title ?? '',
    layout: note.layout ?? '',
    created: note.created ?? '',
    text: note.text ?? '',
    related: list(note.related).map(link => ({
      title: link.title ?? '',
      href: link.href ?? ''
    })),
    links: Object.fromEntries(
      list(note.links).map(link => [link.href, link.to])
    )
  }
}

/**
 * The tool pages, `v1/vault/pages`.
 * @param {string} html
 */
export const read_pages = html =>
  items_of(html, 'page').map(page => ({
    title: page.title ?? '',
    path: page.path
  }))

/**
 * An artifacts folder, `v1/vault/artifacts?folder=`.
 * @param {string} html
 */
export const read_files = html =>
  items_of(html, 'file').map(file => ({
    path: file.path,
    name: file.name ?? '',
    kind: file.kind,
    size: Number(file.size ?? 0),
    mtime_ms: Number(file.mtime_ms ?? 0)
  }))
