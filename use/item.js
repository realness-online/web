import { as_type } from '@/use/itemid'
import { set_vector_dimensions } from '@/use/vector'
export function hydrate(item_as_string = new String()) {
  if (!item_as_string.length) return null
  return document.createRange().createContextualFragment(item_as_string)
}
export function get_item(elements, itemid) {
  if (!elements) return null
  if (typeof elements === 'string') elements = hydrate(elements)
  let main_element = elements.querySelector(`[itemid="${itemid}"]`)
  if (!main_element) main_element = elements.querySelector('[itemid]')
  if (!main_element) return null
  return make_item(main_element)
}
export function make_item(element) {
  return { ...get_meta(element), ...get_itemprops(element) }
}
export function get_meta(item) {
  const meta = {}
  const id = item.getAttribute('itemid')
  let type = item.getAttribute('itemtype')
  if (type) type = type.substring(1)
  if (id && !type) type = as_type(id)
  if (id) meta.id = id
  if (type) meta.type = type
  return meta
}
export function get_itemprops(item) {
  const props = {}
  const properties = Array.from(item.querySelectorAll('[itemprop]'))
  properties.forEach(prop => {
    let value
    if (prop.closest('[itemscope]') === item) value = itemprop_value(prop)
    else if (prop.hasAttribute('itemscope')) value = make_item(prop)
    if (value) {
      const name = prop.getAttribute('itemprop')
      const has_value = props[name]
      if (has_value) {
        if (Array.isArray(has_value)) has_value.push(value)
        else props[name] = [has_value, value]
      } else props[name] = value
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
export function itemprop_value(element) {
  if (element.hasAttribute('content')) return element.getAttribute('content')
  if (element.hasAttribute('datetime')) return element.getAttribute('datetime')
  switch (element.tagName.toLowerCase()) {
    case 'script':
    case 'style':
      return undefined
    case 'a':
    case 'area':
    case 'link':
    case 'use':
      return element.getAttribute('href')
    case 'audio':
    case 'iframe':
    case 'source':
    case 'track':
    case 'video':
    case 'img':
    case 'embed':
      return element.getAttribute('src')
    case 'data':
    case 'meter':
    case 'input':
    case 'textarea':
    case 'select':
      return element.getAttribute('value')
    case 'svg':
    case 'path':
    case 'rect':
    case 'stop':
      return element
    case 'g':
    case 'defs':
      return element.innerHTML
    case 'object':
      return element.data
    default:
      return element.textContent.trim()
  }
}
export default get_item
