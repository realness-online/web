export default {
  get_items(elements, type) {
    if (!elements) { return [] }
    let items_as_data = []
    let query = '[itemscope]'
    if (type) { query += `[itemtype="${type}"]` }
    let items = Array.from(elements.querySelectorAll(query))
    items.forEach(item => {
      let meta = {
        type: item.getAttribute('itemtype'),
        id: item.getAttribute('itemid')
      }
      let properties = this.get_item_properties(item)
      items_as_data.push({ ...meta, ...properties })
    })
    return items_as_data
  },
  get_first_item(elements, type) {
    let item = this.get_items(elements, type)[0]
    return item || {}
  },
  get_item_properties(item) {
    let props = {}
    let properties = Array.from(item.querySelectorAll('[itemprop]'))
    properties.forEach(prop => {
      let name = prop.getAttribute('itemprop')
      let value = this.property_value(prop)
      props[name] = value
    })
    return props
  },
  property_value(element) {
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
