/**
 * Generated items with every value visible. Open one in a browser and the
 * data is on the page; microdata reads the same elements.
 *
 *   <article itemscope itemtype="/plan">
 *     <dl>
 *       <dt>status</dt><dd itemprop="status">active</dd>
 *       <dt>end</dt><dd><time itemprop="end" datetime="2026-10-17T21:27:43.533Z">2026-10-17T21:27:43.533Z</time></dd>
 *       <dt>call</dt><dd><a itemprop="call" href="0349-phone.html">0349-phone.html</a></dd>
 *     </dl>
 *   </article>
 *
 * A time keeps its exact value in `datetime`, a link in `href`; both show it
 * as text too. `read_items` also reads the older all-`<meta content>` form,
 * so files written before stay readable.
 */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const NAMES = { amp: '&', lt: '<', gt: '>', quot: '"' }

export const escape = value =>
  String(value ?? '').replace(/[&<>"]/g, char => ENTITIES[char])
export const unescape = text =>
  text.replace(/&(amp|lt|gt|quot);/g, (_, name) => NAMES[name])

const ISO_TIME = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/

const is_record = value =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** One value as visible markup, under its own name. A list repeats the
 * name; a record is a nested item. */
const value_html = (name, value, link) => {
  if (Array.isArray(value))
    return value.map(each => value_html(name, each, link)).join('')
  if (is_record(value))
    return `<div itemprop="${name}" itemscope><dl>${rows_html(value, [])}</dl></div>`
  const text = escape(value)
  if (link && text) return `<a itemprop="${name}" href="${text}">${text}</a>`
  if (ISO_TIME.test(String(value ?? '')))
    return `<time itemprop="${name}" datetime="${text}">${text}</time>`
  return `<span itemprop="${name}">${text}</span>`
}

/**
 * One item: a heading-free `<dl>` of name and value, every value visible.
 * @param {string} type the itemtype after `/`
 * @param {Record<string, unknown>} fields shown in this order
 * @param {{ links?: string[], tag?: string, extra?: string }} [options]
 *   `links` names fields that are addresses; `extra` is trusted markup
 *   appended inside the item.
 */
export const item_html = (
  type,
  fields,
  { links = [], tag = 'article', extra = '' } = {}
) =>
  `<${tag} itemscope itemtype="/${type}"><dl>${rows_html(fields, links)}</dl>${extra}</${tag}>\n`

/**
 * @param {Record<string, unknown>} fields
 * @param {string[]} links
 */
const rows_html = (fields, links) =>
  Object.entries(fields)
    .map(
      ([name, value]) =>
        `<dt>${name}</dt><dd>${value_html(name, value, links.includes(name))}</dd>`
    )
    .join('')

const PROP =
  /<(\w+)\s+itemprop="(\w+)"((?:\s+\w+="[^"]*")*)\s*\/?>(?:([^<]*)<\/\1>)?/g
const ATTR = /(content|datetime|href|value)="([^"]*)"/

/** The fields of one item's markup, from attributes where they carry the value. */
const fields_of = body => {
  const values = {}
  for (const [, , name, attrs, text] of body.matchAll(PROP)) {
    const attr = attrs.match(ATTR)
    values[name] = unescape(attr ? attr[2] : (text ?? ''))
  }
  return values
}

/**
 * Every `/type` item in `html`, as `{ name: value }` in document order.
 * @param {string} html
 * @param {string} type
 * @returns {Record<string, string>[]}
 */
export const read_items = (html, type) => {
  const found = []
  const open = new RegExp(
    `<(\\w+) itemscope(?:\\s+[\\w-]+="[^"]*")*\\s+itemtype="/${type}">`,
    'g'
  )
  for (const match of String(html).matchAll(open)) {
    const start = match.index + match[0].length
    const end = html.indexOf(`</${match[1]}>`, start)
    if (end === -1) continue
    found.push(fields_of(html.slice(start, end)))
  }
  return found
}

/** The first `/type` item, or null. */
export const read_item = (html, type) => read_items(html, type)[0] ?? null
