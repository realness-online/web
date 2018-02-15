class Item {
  static get_items(elements, type) {
    if (!elements) { return [] }
    let items_as_data = []
    let query = '[itemscope]'
    if (type) { query += `[itemtype="${type}"]` }
    let items = Array.from(elements.querySelectorAll(query))
    items.forEach(item => {
      let meta = {
        type: item.getAttribute('itemtype'),
        id: item.getAttribute('itemid'),
        element_id: item.getAttribute('id')
      }
      let properties = Item.get_item_properties(item)
      items_as_data.push({ ...meta, ...properties })
    })
    return items_as_data
  }

  static get_first_item(elements, type) {
    let item = Item.get_items(elements, type)[0]
    return item || {}
  }

  static get_item_properties(item) {
    let props = {}
    let properties = Array.from(item.querySelectorAll('[itemprop]'))
    properties.forEach(prop => {
      let name = prop.getAttribute('itemprop')
      let value = Item.property_value(prop)
      props[name] = value
    })
    return props
  }

  static property_value(element) {
    if (element.getAttribute('data-value')) {
      return element.getAttribute('data-value')
    }
    switch (element.tagName.toLowerCase()) {
      case 'a':
      case 'link':
        return element.getAttribute('href')
      case 'img':
      case 'object':
      case 'embed':
        return element.getAttribute('src')
      case 'input':
      case 'textarea':
      case 'select':
        return element.value
      case 'meta':
        return element.getAttribute('content')
      case 'time':
        return element.getAttribute('datetime')
      default: return element.textContent.trim()
    }
  }
}
// document.getItems = Item.get_items
export default Item
