import { as_type } from '@/helpers/itemid'
export function hydrate (item_as_string) {
  if (item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
  } else return null
}
export function get_item (elements, itemid) {
  if (!elements) return []
  if (typeof elements === 'string') elements = hydrate(elements)
  let main_element = elements.querySelector(`[itemid="${itemid}"]`)
  if (!main_element) main_element = elements.querySelector(`[itemid]`)
  if (!main_element) return null
  return make_item(main_element)
}
export function make_item (element) {
  return { ...get_meta(element), ...get_itemprops(element) }
}
export function get_meta(item) {
  const meta = {}
  const id = item.getAttribute('itemid')
  let type = item.getAttribute('itemtype')
  if (id && !type) type = as_type(id)
  if (id) meta.id = id
  if (type) meta.type = type
  return meta
}
export function get_itemprops (item) {
  const props = {}
  const properties = Array.from(item.querySelectorAll('[itemprop]'))
  properties.forEach(prop => {
    const name = prop.getAttribute('itemprop')
    let value
    if (prop.hasAttribute('itemscope')) value = make_item(prop)
    else value = itemprop_value(prop)
    let has_value
    if (has_value = props[name]) {
      if (Array.isArray(has_value)) has_value.push(value)
      else props[name] = [has_value, value]
    } else props[name] = value
  })
  switch (item.tagName.toLowerCase()) {
    case 'svg':
    case 'symbol':
      props.viewbox = item.getAttribute('viewBox')
  }
  return props
}
export function itemprop_value (element) {
  if (element.hasAttribute('content')) return element.getAttribute('content')
  if (element.hasAttribute('datetime')) return element.getAttribute('datetime')
  switch (element.tagName.toLowerCase()) {
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
      return element.value
    case 'svg':
    case 'path':
    case 'symbol':
      return element.outerHTML
    case 'g':
    case 'defs':
      return element.innerHTML
    case 'object':
      return element.getAttribute('data')
    default:
      return element.textContent.trim()
  }
}
export default get_item
