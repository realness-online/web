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
  if (!itemid) itemid = main_element.getAttribute('itemid')
  const me = {
    id: itemid,
    type: as_type(itemid),
    ...get_itemprops(main_element)
  }
  const items = []
  let query = '[itemscope]'
  const items_as_element = Array.from(main_element.querySelectorAll(query))
  items_as_element.forEach(item => {
    const id = item.getAttribute('itemid')
    let type = item.getAttribute('itemtype')
    if (id && !type) type = as_type(id)
    const meta = {}
    if (id) meta.id = id
    if (type) meta.type = type
    items.push({ ...meta, ...get_itemprops(item) })
  })
  if (items_as_element.length) me.items = items
  return me
}
export function get_itemprops (item) {
  const props = {}
  const properties = Array.from(item.querySelectorAll('[itemprop]'))
  properties.forEach(prop => {
    const name = prop.getAttribute('itemprop')
    let value
    if (prop.hasAttribute('itemscope')) {
      value = get_itemprops(prop)
    } else value = property_value(prop)

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
export function property_value (element) {
  if (element.getAttribute('content')) {
    return element.getAttribute('content')
  }
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
    case 'time':
      return element.getAttribute('datetime')
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
export default { get_item }
