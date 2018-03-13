import Item from '@/modules/Item'

describe('Item.js', () => {
  let item
  beforeEach(() => {
    const html_item  = `
    <main id="profile" itemscope itemtype="/person" itemid='/person/666'>
      <section>
        <h1 itemprop="name">Scott Fryxell</h1>
        <h2 itemprop="nickname" data-value="scoot">lame</h2>
      </section>
      <section>
        <a itemprop="url" href="/people/scott">homepage</a>
        <link itemprop="style" rel="stylesheet" href="/people/666/style.css">
      </section>
      <section>
        <img itemprop="profile_pic" src="/people/666/profile.svg">
        <object itemprop="logo_pic" src="/people/666/logo.svg" >
        <embed type="video/quicktime" src="/people/666/movie.mp4" width="300" height="300">
      </section>
      <form>
        <input type="text" itemprop="quicky" value="text input value">
        <textarea itemprop="description" name="description" rows="8" cols="80">textarea value</textarea>
        <select itemprop="gender">
          <option selected value="male">male</option>
          <option value="female">female</optipon>
        </select>
      </form>
      <section>
        <time itemprop="created_at" datetime="2017-12-20T23:01:14.310Z"></time>
        <meta itemprop="social_media" name="facebook:" content="facebook.dom/scott-fryxell">
      </section>
    </main>`
    document.body.innerHTML = html_item
  })

  describe('get_items()', () => {
    beforeEach(() => {
      let items = Item.get_items(document.body, '/person')
      item = items[0]
    })

    it('has meta data about the item', () => {
      expect(item.type).toBe('/person')
      expect(item.element_id).toBe('profile')
      expect(item.id).toBe('/person/666')
    })

    it('gets the properties of an item', () => {
      expect(item.name).toBe('Scott Fryxell')
      expect(item.nickname).toBe('scoot')
      expect(item.url).toBe('/people/scott')
      expect(item.style).toBe('/people/666/style.css')
    })
  })

  describe('get_first_item()', () => {
    it('returns the first of an object found', () => {
      const person = Item.get_first_item(document.body, '/person')
      expect(person.name).toBe('Scott Fryxell')
      expect(person.nickname).toBe('scoot')
      expect(person.url).toBe('/people/scott')
      expect(person.style).toBe('/people/666/style.css')
    })
    it('returns false if no object is found', () => {
      const dodo = Item.get_first_item(document.body, '/dodo')
      expect(dodo).toBe(false)
    })
  })
})
