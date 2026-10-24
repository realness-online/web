/**
 * Read grants from a person's rights page, `people/+A/rights.html`.
 *
 * Each grant is one Schema.org DigitalDocumentPermission:
 *
 *   <li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
 *     <data itemprop="grantee" value="/+A/harnesses/1726000000000">/+A/harnesses/1726000000000</data>
 *     <a itemprop="permissionType" href="https://schema.org/ReadPermission">read</a>
 *     <a itemprop="about" href="/+A/plans/">plans</a>
 *   </li>
 *
 * Every value shows on the page, but is read from `value`, `content`,
 * `href`, or `src`; text content is never read, so what a page shows can
 * never grant more than its attributes do.
 * Comments are dropped, so a commented-out grant is revoked.
 * Anything we cannot read with certainty throws. The caller denies on a throw.
 */

const PERMISSION = 'https://schema.org/DigitalDocumentPermission'
const TYPES = {
  'https://schema.org/ReadPermission': 'read',
  'https://schema.org/WritePermission': 'write'
}
const VOID = new Set([
  'meta',
  'link',
  'br',
  'img',
  'input',
  'hr',
  'source',
  'wbr'
])
const TAG =
  /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

/**
 * Attribute names to values, lowercased. A bare attribute maps to an empty
 * string, which is how `itemscope` and `itemref` are detected.
 * @param {string} text
 * @returns {Record<string, string>}
 */
const attributes = text => {
  /** @type {Record<string, string>} */
  const found = {}
  for (const [, name, a, b, c] of text.matchAll(ATTR))
    found[name.toLowerCase()] = a ?? b ?? c ?? ''
  return found
}

/** Grants as `{ grantee, action, path }` triples. Throws on a malformed page. */
export const read_rights = source => {
  if (typeof source !== 'string') throw new Error('rights page is not text')
  const html = source.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  if (/<(script|template|textarea)\b/i.test(html))
    throw new Error('rights page: raw or inert content')
  const stack = []
  const grants = []
  /**
   * The permission currently being read.
   * @type {{ depth: number, props: Record<string, string[]> } | null}
   */
  let open = null
  for (const [, closing, raw, attrs, self] of html.matchAll(TAG)) {
    const name = raw.toLowerCase()
    if (closing) {
      if (VOID.has(name)) continue
      const top = stack.pop()
      if (top !== name)
        throw new Error(`rights page: </${name}> closes <${top}>`)
      if (open && stack.length === open.depth) {
        grants.push(finish(open.props))
        open = null
      }
      continue
    }
    const a = attributes(attrs)
    if (open && 'itemprop' in a) {
      const value = a.value ?? a.content ?? a.href ?? a.src
      if (value === undefined)
        throw new Error(`rights page: ${a.itemprop} has no value`)
      open.props[a.itemprop] = [...(open.props[a.itemprop] ?? []), value]
    }
    if (open && 'itemscope' in a)
      throw new Error('rights page: item inside a permission')
    if ('itemscope' in a && a.itemtype === PERMISSION) {
      if ('itemref' in a)
        throw new Error('rights page: itemref on a permission')
      if (VOID.has(name) || self)
        throw new Error('rights page: empty permission')
      open = { depth: stack.length, props: {} }
    }
    if (!VOID.has(name) && !self) stack.push(name)
  }
  if (open || stack.length) throw new Error('rights page: unclosed element')
  return grants
}

const finish = props => {
  const one = name => {
    const values = props[name] ?? []
    if (values.length !== 1)
      throw new Error(`rights page: need exactly one ${name}`)
    return values[0].trim()
  }
  const action = TYPES[one('permissionType')]
  if (!action) throw new Error('rights page: unknown permissionType')
  return { grantee: one('grantee'), action, path: one('about') }
}
