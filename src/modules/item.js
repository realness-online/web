export default {
  hydrate (item_as_string) {
    if (item_as_string) {
      return document.createRange().createContextualFragment(item_as_string)
    } else return null
  },
  get_items (elements, type) {
    if (!elements) return []
    if (typeof elements === 'string') elements = this.hydrate(elements)
    const items_as_data = []
    let query = '[itemscope]'
    if (type) { query += `[itemtype="${type}"]` }
    const items = Array.from(elements.querySelectorAll(query))
    items.forEach(item => {
      const meta = {
        id: item.getAttribute('itemid'),
        type: item.getAttribute('itemtype')
      }
      const properties = this.get_item_properties(item)
      items_as_data.push({ ...meta, ...properties })
    })
    return items_as_data
  },
  get_first_item (elements, type) {
    const item = this.get_items(elements, type)[0]
    return item || {}
  },
  get_item_properties (item) {
    const props = {}
    const properties = Array.from(item.querySelectorAll('[itemprop]'))
    properties.forEach(prop => {
      const name = prop.getAttribute('itemprop')
      if (props[name]) return // first set value wins
      const value = this.property_value(prop)
      props[name] = value
    })
    return props
  },
  property_value (element) {
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
}
