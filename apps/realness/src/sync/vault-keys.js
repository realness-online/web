/**
 * v3d: the key layout data stays in the vault's generated page. This reads its
 * tables into plain objects; the app draws them.
 */

/** One quoted JavaScript string, escapes read. @param {string} raw */
const string_value = raw =>
  raw
    .replace(/\\u([\da-f]{4})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\(.)/g, '$1')

/** The quoted strings inside a JavaScript array literal. @param {string} body */
const strings_in = body =>
  [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(([, s]) => string_value(s))

/** The body of one literal, from its opening line to the given closing pattern. */
const block_of = (source, opener, close) => {
  const start = source.indexOf(opener)
  if (start < 0) return ''
  const rest = source.slice(start + opener.length)
  const end = rest.search(close)
  return end < 0 ? '' : rest.slice(0, end)
}

const OBJECT_CLOSE = /\n\}/

/** Each key in a block: [group, option label, Option+Shift label]. */
const entries_of = block =>
  Object.fromEntries(
    [...block.matchAll(/^\s*(?:'([^']*)'|(\w+)):\s*\[([^\]]*)\]/gm)].map(
      ([, quoted, bare, values]) => [quoted ?? bare, strings_in(values)]
    )
  )

/** The page's maps by name; the leader map spreads the bare one, as the page does. */
const layouts_named = (source, layouts_block) => {
  const bare = entries_of(block_of(source, 'const today = {', OBJECT_CLOSE))
  return Object.fromEntries(
    [...layouts_block.matchAll(/^ {2}(\w+):\s*\{([\s\S]*?)\n {2}\}/gm)].map(
      ([, name, body]) => [
        name,
        name === 'leader' ? { ...bare, ...entries_of(body) } : entries_of(body)
      ]
    )
  )
}

/**
 * @typedef {{ rows: string[], layouts: Record<string, Record<string, string[]>>, panel_on: string[], pi_reserved: string[], pi_windows: string[], page?: ReturnType<typeof key_page> }} KeyLayouts
 */

/**
 * Everything the key layout drawing needs, read from the page's script.
 * @param {string} source the page's JavaScript
 * @returns {KeyLayouts}
 */
export const key_layouts = source => {
  const layouts_block = block_of(source, 'layouts = {', OBJECT_CLOSE)
  return {
    rows: [
      ...block_of(source, 'const rows = [', /\n/).matchAll(
        /'([^']*)'|"([^"]*)"/g
      )
    ].map(([, single, double]) => string_value(single ?? double)),
    layouts: layouts_named(source, layouts_block),
    panel_on: strings_in(block_of(source, 'const panel_on = new Set([', /\]/)),
    pi_reserved: strings_in(
      block_of(source, 'const pi_reserved = new Set([', /\]/)
    ),
    pi_windows: strings_in(
      block_of(source, 'const pi_windows = new Set([', /\]/)
    )
  }
}
/** One tag's text, its own tags dropped. @param {string} html */
const words = html =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/**
 * One `data-<name>` value on a list item, as `{ name: value }`, or nothing.
 * @param {string} item
 * @param {'group' | 'reserved'} name
 */
const attribute_of = (item, name) => {
  const value = new RegExp(`(?:^|\\s)data-${name}="([^"]+)"`).exec(item)?.[1]
  return value ? { [name]: value } : {}
}

/** The definition pairs in one `<dl>`. */
const terms_of = html =>
  [...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(
    ([, term, detail]) => ({ term: words(term), detail: words(detail) })
  )

/**
 * The key layouts page as prose and figures: the words stay in the vault, the
 * boards are drawn by the app.
 * @param {string} html the page markup
 * @returns {{ title: string, description: string, legend: {label: string, group?: string, reserved?: string}[], notes: string[], sections: {title: string, figures: {map: string, panel: boolean, caption: string}[], terms: {term: string, detail: string}[]}[] }}
 */
export const key_page = html => {
  const main = /<main>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? ''
  const header = /^[\s\S]*?<header>([\s\S]*?)<\/header>/.exec(main)?.[1] ?? ''
  const legend_block =
    /<ul aria-label="Legend">([\s\S]*?)<\/ul>/.exec(header)?.[1] ?? ''
  return {
    title: words(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(header)?.[1] ?? ''),
    description: words(
      /<p itemprop="description">([\s\S]*?)<\/p>/.exec(header)?.[1] ?? ''
    ),
    legend: [...legend_block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(
      ([item, label]) => ({
        label: words(label),
        ...attribute_of(item, 'group'),
        ...attribute_of(item, 'reserved')
      })
    ),
    notes: [...header.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, body]) =>
      words(body)
    ),
    sections: [
      ...main.matchAll(/<section id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)
    ].map(([, id, body]) => ({
      id,
      title: words(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? ''),
      figures: [...body.matchAll(/<figure([^>]*)>([\s\S]*?)<\/figure>/g)].map(
        ([, attributes, inner]) => ({
          map: /data-map="([^"]+)"/.exec(attributes)?.[1] ?? '',
          panel: /data-panel/.test(attributes),
          caption: words(
            /<figcaption>([\s\S]*?)<\/figcaption>/.exec(inner)?.[1] ?? ''
          )
        })
      ),
      terms: terms_of(/<dl>([\s\S]*?)<\/dl>/.exec(body)?.[1] ?? '')
    }))
  }
}
