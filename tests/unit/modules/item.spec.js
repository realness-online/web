import { get_item, hydrate } from '@/modules/item'
const fs = require('fs')
const html_item = fs.readFileSync('./tests/unit/html/Item.html', 'utf8')
describe('@/modules/item.js', () => {
  let item
  describe('Methods', () => {
    describe('get_item()', () => {
      beforeEach(() => {
        item = get_item(html_item)
      })
      it('Will work when you feed it elements', () => {
        document.body.innerHTML = html_item
        item = get_item(document.body, '/+16282281824')
        expect(item.type).toBe('person')
        expect(item.id).toBe('/+16282281824')
      })
      it('Returns null if no elements provided', () => {
        const items = get_item()
        expect(items).toBe(null)
      })
      it('Has meta data about the item', () => {
        expect(item.type).toBe('person')
        expect(item.id).toBe('/+16282281824')
      })
      it('Gets the properties of an item', () => {
        expect(item.name).toBe('Scott Fryxell')
        expect(item.nickname).toBe('scoot')
        expect(item.url).toBe('/people/scott')
        expect(item.style).toBe('/people/666/style.css')
        expect(item.third_vector).toBe('<svg itemprop="third_vector"></svg>')
      })
      it('Fails without an itemid', () => {
        item = get_item(`
        <section itemscope itemtype="person">
          <h1 itemprop="name">Scott Fryxell</h1>
        </section>`)
        expect(item).toBe(null)
      })
    })
    describe('#hydrate', () => {
      const simple_item = `
      <section itemscope itemtype="person">
        <h1 itemprop="name">Scott Fryxell</h1>
      </section>`

      it('Exists', () => {
        expect(hydrate).toBeDefined()
      })
      it('Fails gracefully', () => {
        expect(hydrate()).toBe(null)
      })
      it('Will create an html fragment from a string', () => {
        const storage = hydrate(simple_item)
        expect(storage.querySelectorAll('h1').length).toBe(1)
      })
    })
  })
})
