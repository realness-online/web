import Storage from '@/modules/Storage'
describe('Storage.js', () => {
  let item_as_string, storage
  beforeEach(() => {
    item_as_string = `
     <main id="profile" itemscope itemtype="/person" itemid='/person/666'>
       <section>
         <h1 itemprop="name">Scott Fryxell</h1>
         <h2 itemprop="nickname" data-value="scoot">lame</h2>
       </section>
     </main>`
     document.body.innerHTML = item_as_string
     storage = new Storage('/person')
  })
  describe('hydrate()', ()=>{
    it('exists', () => {
      expect(Storage.hydrate).toBeDefined()
    })
    it('will create an html fragmend from a string', () => {
      expect(Storage.hydrate(item_as_string).getItems().length).toBe(1)
    })
  })
  describe('load()', () =>{
    it('exists', () => {
      expect(storage.load).toBeDefined()
    })
  })
  describe('save()', () => {
    it('exists', () => {
      expect(storage.save).toBeDefined()
    })
    it('saves and loads an item from local storage', () => {
      storage.save()
      const items = storage.load()
      expect(items.length).toBe(1)
    })
  })
})
