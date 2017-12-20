class Item {
  static get_items(type) {
    let items_as_data = []
    let query = '[itemscope]'
    if (type) {
      query += `[itemtype="${type}"]`
    }

    let items = Array.from(this.querySelectorAll(query))

    items.forEach(item => {
      // let meta = {
      //   type: item.getAttribute('itemtype'),
      //   id:   item.getAttribute('itemid'),
      //   element_id: item.getAttribute('id')
      // }
      // let properties = Item.get_item_properties(item)
      //
      // items_as_data.push( { ...meta, ...properties } )

      let properties = Item.get_item_properties(item)
      properties['type'] = item.getAttribute('itemtype')
      items_as_data.push(properties)
    })
    return items_as_data
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
    if (element.dataset.value) {
      return element.dataset.value
    }
    switch (element.tagName.toLowerCase()) {
      case 'link' || 'a': return element.getAttribute('href')
      case 'img' || 'object' || 'embed': return element.getAttribute('src')
      case 'meta': return element.getAttribute('content')
      case 'time': return element.getAttribute('datetime')
      case 'input' || 'textarea' || 'select': return element.value
      default: return element.textContent.trim()
    }
  }
}
document.getItems = Item.get_items
export default Item
