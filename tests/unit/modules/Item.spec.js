import Item from '@/modules/item'
const fs = require('fs')
const html_item = fs.readFileSync('./tests/unit/html/item.html', 'utf8')
describe('@/modules/item.js', () => {
  let item
  beforeEach(() => {
    document.body.innerHTML = html_item
  })
  describe('get_items()', () => {
    beforeEach(() => {
      const items = Item.get_items(document.body, '/person')
      item = items[0]
    })
    it('Fails gracefully if no elements provided', () => {
      const items = Item.get_items(null, '/person')
      expect(items.length).toBe(0)
    })
    it('Has meta data about the item', () => {
      expect(item.type).toBe('/person')
      expect(item.id).toBe('/people/666')
    })
    it('Gets the properties of an item', () => {
      expect(item.name).toBe('Scott Fryxell')
      expect(item.nickname).toBe('scoot')
      expect(item.url).toBe('/people/scott')
      expect(item.style).toBe('/people/666/style.css')
      expect(item.third_vector).toBe('<svg itemprop="third_vector"></svg>')
    })
  })
  describe('get_first_item()', () => {
    it('Returns the first of an object type', () => {
      const person = Item.get_first_item(document.body, '/person')
      expect(person.name).toBe('Scott Fryxell')
      expect(person.nickname).toBe('scoot')
      expect(person.url).toBe('/people/scott')
      expect(person.style).toBe('/people/666/style.css')
    })
    it('Gets first item of any type', () => {
      const item = Item.get_first_item(document.body)
      expect(item.name).toBe('Scott Fryxell')
      expect(item.nickname).toBe('scoot')
      expect(item.url).toBe('/people/scott')
      expect(item.style).toBe('/people/666/style.css')
    })
    it('Returns an empty object if no item is found', () => {
      const dodo = Item.get_first_item(document.body, '/dodo')
      expect(dodo).toEqual({})
    })
  })
  describe('#hydrate', () => {
    const item_as_string = `
    <section itemscope itemtype="/people">
      <h1 itemprop="name">Scott Fryxell</h1>
    </section>`
    it('Exists', () => {
      expect(Item.hydrate).toBeDefined()
    })
    it('Will create an html fragment from a string', () => {
      const storage = Item.hydrate(item_as_string)
      expect(storage.querySelectorAll('h1').length).toBe(1)
    })
  })
})
