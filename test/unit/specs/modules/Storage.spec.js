import Storage from '@/modules/Storage'
describe('Storage.js', () => {
  let item_as_string, person
  beforeEach(() => {
    item_as_string = `
     <main id="profile" itemscope itemtype="/person" itemid='/person/666'>
       <section>
         <h1 itemprop="name">Scott Fryxell</h1>
         <h2 itemprop="nickname" data-value="scoot">lame</h2>
       </section>
     </main>`
     document.body.innerHTML = item_as_string
     person = new Storage('person')
  })
  describe('hydrate()', () => {
    it('exists', () => {
      expect(Storage.hydrate).toBeDefined()
    })
    it('will create an html fragmend from a string', () => {
      person = Storage.hydrate(item_as_string)
      expect(person.querySelectorAll('h1').length).toBe(1)
    })
  })
  describe('from_storage()', () => {
    it('exists', () => {
      expect(person.from_storage).toBeDefined()
    })
  })
  describe('save()', () => {
    it('exists', () => {
      expect(person.save).toBeDefined()
    })
  })
  describe('retrieving objects from html', () => {
    describe('as_list()', () => {
      it('exists', () => {
        expect(person.as_list).toBeDefined()
      })
      it('will return a list of items')
    })

    describe('as_object()', () => {
      it('exists', () => {
        expect(person.as_object).toBeDefined()
      })

      it('will return the first item it finds')
    })
  })

  it('saves and loads an item from local storage', () => {
    expect(person.save()).toBe(true)
    const items = person.from_storage()
    expect(items.querySelectorAll('h1').length).toBe(1)
  })
})
