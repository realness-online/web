/** @typedef {import('@/types').Id} Id */
import { get_item } from '@/utils/item'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * @param {unknown} members - `item.js` gives a string for one `<desc itemprop="members">`,
 *   or an array when repeated; tolerate both.
 * @returns {string[]}
 */
const split_members = members => {
  if (!members) return []
  const parts = Array.isArray(members) ? members : [members]
  return parts
    .flatMap(part => (typeof part === 'string' ? part.split(/\s+/) : []))
    .filter(Boolean)
}

/**
 * @param {string | undefined} subject_id - full subject itemid (`…/subjects/<local>`)
 * @param {Id} itemid - poster itemid
 * @returns {string}
 */
const local_id = (subject_id, itemid) => {
  if (!subject_id) return ''
  const prefix = `${itemid}/subjects/`
  return subject_id.startsWith(prefix)
    ? subject_id.slice(prefix.length)
    : subject_id
}

/**
 * Parse a poster's subjects from its stored index markup.
 * @param {string} poster_html
 * @param {Id} itemid
 * @returns {{ id: string, name: string, keys: Set<string> }[]}
 */
export const read_subjects = (poster_html, itemid) => {
  const item = /** @type {Record<string, unknown> | null} */ (
    get_item(poster_html, itemid)
  )
  const raw = item?.subject
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map(entry => {
    const subject =
      /** @type {{ id?: string, name?: unknown, members?: unknown }} */ (entry)
    return {
      id: local_id(subject.id, itemid),
      name: typeof subject.name === 'string' ? subject.name : '',
      keys: new Set(split_members(subject.members))
    }
  })
}

/**
 * Write subjects into a poster index element as SVG-native `<metadata>` microdata. References
 * only (`<layer>:<index>`), never geometry. Replaces any subjects we previously wrote.
 * @param {Element | null | undefined} poster_el
 * @param {Id} itemid
 * @param {{ id: string, name: string, keys: Set<string> }[]} subjects
 */
export const write_subjects = (poster_el, itemid, subjects) => {
  if (!poster_el) return
  poster_el
    .querySelectorAll('[itemprop="subject"][itemtype="/subject"]')
    .forEach(node => node.remove())
  if (!subjects.length) {
    poster_el.querySelectorAll('metadata:empty').forEach(node => node.remove())
    return
  }
  const doc = poster_el.ownerDocument
  let metadata = poster_el.querySelector(':scope > metadata')
  if (!metadata) {
    metadata = doc.createElementNS(SVG_NS, 'metadata')
    poster_el.appendChild(metadata)
  }
  for (const subject of subjects) {
    const group = doc.createElementNS(SVG_NS, 'g')
    group.setAttribute('itemprop', 'subject')
    group.setAttribute('itemscope', '')
    group.setAttribute('itemtype', '/subject')
    group.setAttribute('itemid', `${itemid}/subjects/${subject.id}`)

    const name = doc.createElementNS(SVG_NS, 'desc')
    name.setAttribute('itemprop', 'name')
    name.textContent = subject.name || ''

    const members = doc.createElementNS(SVG_NS, 'desc')
    members.setAttribute('itemprop', 'members')
    members.textContent = [...subject.keys].join(' ')

    group.append(name, members)
    metadata.appendChild(group)
  }
}
