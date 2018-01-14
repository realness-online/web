import Storage from '@/modules/Storage'

describe('Storage.js', () => {
  let item_as_string
  beforeEach(() => {
    item_as_string = `
     <main id="profile" itemscope itemtype="/person" itemid='/person/666'>
       <section>
         <h1 itemprop="name">Scott Fryxell</h1>
         <h2 itemprop="nickname" data-value="scoot">lame</h2>
       </section>
     </main>`
     document.body.innerHTML = item_as_string
  })

  it('hydrate()', () => {
    expect(Storage.hydrate(item_as_string)).toBeDefined()
  })

  describe('load()', () =>{
    it('writes html to localStorage', () => {
      let storage = new Storage('person', '/person')
      expect(storage.load).toBeDefined()
    })
  })

  it('save()', () => {
    let storage = new Storage('person', '/person')
    expect(storage.save).toBeDefined()
  })

})
