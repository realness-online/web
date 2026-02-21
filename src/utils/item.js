/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

import { as_type } from '@/utils/itemid'
import { set_vector_dimensions } from '@/use/poster'

/**
 * @param {string} item_as_string
 * @returns {DocumentFragment | null}
 */
export function hydrate(item_as_string = '') {
  if (!item_as_string.length) return null
  return document.createRange().createContextualFragment(item_as_string)
}

/**
 * @param {DocumentFragment | string} elements
 * @param {Id} itemid
 * @returns {Item | null}
 */
export const get_item = (elements, itemid) => {
  if (!elements) return null
  const fragment = typeof elements === 'string' ? hydrate(elements) : elements
  if (!fragment) return null
  let main_element = fragment.querySelector(`[itemid="${itemid}"]`)
  if (!main_element) main_element = fragment.querySelector('[itemid]')
  if (!main_element) return null
  return make_item(main_element)
}
/**
 * @param {Element} element
 * @returns {Item}
 */
export const make_item = element => ({
  ...get_meta(element),
  ...get_itemprops(element)
})
/**
 * @param {Element} item
 * @returns {{id?: string, type?: string}}
 */
export const get_meta = item => {
  const meta = {}
  const id = item.getAttribute('itemid')
  let type = item.getAttribute('itemtype')
  if (type) type = type.substring(1)
  if (id && !type) type = as_type(/** @type {import('@/types').Id} */ (id))
  if (id) meta.id = id
  if (type) meta.type = type
  return meta
}
/**
 * @param {Element} item
 * @returns {Object}
 */
export const get_itemprops = item => {
  const props = {}
  const properties = Array.from(item.querySelectorAll('[itemprop]'))
  properties.forEach(prop => {
    let value
    if (prop.closest('[itemscope]') === item) value = itemprop_value(prop)
    else if (prop.hasAttribute('itemscope')) value = make_item(prop)
    if (value) {
      const name = prop.getAttribute('itemprop')
      const has_value = props[name]
      if (has_value)
        if (Array.isArray(has_value)) has_value.push(value)
        else props[name] = [has_value, value]
      else props[name] = value
    }
  })
  switch (item.tagName.toLowerCase()) {
    case 'svg':
    case 'symbol':
    case 'marker':
    case 'view':
    case 'pattern':
      set_vector_dimensions(props, item)
  }
  return props
}
/** @type {Record<string, (el: Element) => string | Element | undefined>} */
const tag_value_handlers = {
  script: () => undefined,
  style: () => undefined,
  a: el => el.getAttribute('href') ?? undefined,
  area: el => el.getAttribute('href') ?? undefined,
  link: el => el.getAttribute('href') ?? undefined,
  use: el => el.getAttribute('href') ?? undefined,
  audio: el => el.getAttribute('src') ?? undefined,
  iframe: el => el.getAttribute('src') ?? undefined,
  source: el => el.getAttribute('src') ?? undefined,
  track: el => el.getAttribute('src') ?? undefined,
  video: el => el.getAttribute('src') ?? undefined,
  img: el => el.getAttribute('src') ?? undefined,
  embed: el => el.getAttribute('src') ?? undefined,
  data: el => el.getAttribute('value') ?? undefined,
  meter: el => el.getAttribute('value') ?? undefined,
  input: el => el.getAttribute('value') ?? undefined,
  textarea: el => el.getAttribute('value') ?? undefined,
  select: el => el.getAttribute('value') ?? undefined,
  svg: el => el,
  path: el => el,
  rect: el => el,
  stop: el => el,
  g: el => el.innerHTML,
  defs: el => el.innerHTML,
  object: el => /** @type {HTMLObjectElement} */ (el).data
}

/**
 * @param {Element} element
 * @returns {string | Element | undefined}
 */
export const itemprop_value = element => {
  if (element.hasAttribute('content'))
    return element.getAttribute('content') ?? undefined
  if (element.hasAttribute('datetime'))
    return element.getAttribute('datetime') ?? undefined
  const handler = tag_value_handlers[element.tagName.toLowerCase()]
  if (handler) return handler(element)
  return (element.textContent ?? '').trim()
}
export default get_item
