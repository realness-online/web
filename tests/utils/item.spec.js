import { describe, it, expect } from 'vite-plus/test'
import get_item, { hydrate, get_itemprops } from '@/utils/item'

describe('@/utils/item', () => {
  describe('hydrate', () => {
    it('returns null for empty string', () => {
      expect(hydrate('')).toBeNull()
      expect(hydrate()).toBeNull()
    })

    it('parses html into a queryable fragment', () => {
      const fragment = hydrate('<div itemid="/+1">hi</div>')
      expect(fragment?.querySelector('[itemid]')?.textContent).toBe('hi')
    })
  })

  describe('get_item', () => {
    it('returns null for missing elements', () => {
      expect(get_item(/** @type {any} */ (null), '/+1')).toBeNull()
      expect(get_item('', '/+1')).toBeNull()
    })

    it('returns null when no itemid is present', () => {
      expect(get_item('<div>no id</div>', '/+1')).toBeNull()
    })

    it('finds the matching itemid first', () => {
      const html = `
        <div itemid="/+1" itemscope itemtype="/person">
          <h3 itemprop="name">One</h3>
        </div>
        <div itemid="/+2" itemscope itemtype="/person">
          <h3 itemprop="name">Two</h3>
        </div>
      `
      const item = get_item(html, /** @type {import('@/types').Id} */ ('/+2'))
      expect(item?.id).toBe('/+2')
      expect(item?.name).toBe('Two')
    })

    it('falls back to the first itemid when the target is missing', () => {
      const html = `
        <address itemid="/+14151234356" itemscope itemtype="/person">
          <h3 itemprop="name">Ada</h3>
        </address>
      `
      const item = get_item(html, /** @type {import('@/types').Id} */ ('/+999'))
      expect(item?.id).toBe('/+14151234356')
      expect(item?.name).toBe('Ada')
      expect(item?.type).toBe('person')
    })

    it('infers type from itemid when itemtype is missing', () => {
      const html = `<section itemid="/+1/relations" itemscope>
        <meta itemprop="count" content="2" />
      </section>`
      const item = get_item(
        html,
        /** @type {import('@/types').Id} */ ('/+1/relations')
      )
      expect(item?.type).toBe('relations')
      expect(item?.count).toBe('2')
    })

    it('accepts an existing DocumentFragment', () => {
      const fragment = hydrate(
        `<div itemid="/+1" itemscope itemtype="/person"><span itemprop="name">Frag</span></div>`
      )
      const item = get_item(
        /** @type {DocumentFragment} */ (fragment),
        /** @type {import('@/types').Id} */ ('/+1')
      )
      expect(item?.name).toBe('Frag')
    })

    it('is the default export', () => {
      expect(get_item).toBeTypeOf('function')
    })
  })

  describe('get_itemprops', () => {
    it('reads content and datetime attributes', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <meta itemprop="role" content="admin" />
        <time itemprop="visited" datetime="2024-01-02T03:04:05.000Z">when</time>
      `
      expect(get_itemprops(el)).toEqual({
        role: 'admin',
        visited: '2024-01-02T03:04:05.000Z'
      })
    })

    it('aggregates duplicate itemprops into arrays', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <span itemprop="tag">a</span>
        <span itemprop="tag">b</span>
        <span itemprop="tag">c</span>
      `
      expect(get_itemprops(el).tag).toEqual(['a', 'b', 'c'])
    })

    it('nests nested itemscope itemprops', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.setAttribute('itemid', '/+1')
      el.innerHTML = `
        <div itemprop="avatar" itemscope itemtype="/posters" itemid="/+1/posters/9">
          <meta itemprop="viewbox" content="0 0 10 10" />
        </div>
      `
      const props = get_itemprops(el)
      expect(props.avatar).toMatchObject({
        id: '/+1/posters/9',
        type: 'posters',
        viewbox: '0 0 10 10'
      })
    })

    it('skips script and style itemprops', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <script itemprop="code">alert(1)</script>
        <style itemprop="css">.x{}</style>
        <span itemprop="name">ok</span>
      `
      expect(get_itemprops(el)).toEqual({ name: 'ok' })
    })

    it('reads url-like attributes from link tags', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <a itemprop="website" href="https://example.com">site</a>
        <img itemprop="photo" src="/photo.png" />
        <data itemprop="score" value="42"></data>
      `
      expect(get_itemprops(el)).toEqual({
        website: 'https://example.com',
        photo: '/photo.png',
        score: '42'
      })
    })

    it('covers remaining media and form tag handlers', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <area itemprop="hotspot" href="#spot" />
        <link itemprop="canonical" href="/canon" />
        <use itemprop="icon" href="#sym"></use>
        <audio itemprop="clip" src="/a.mp3"></audio>
        <iframe itemprop="embed" src="/frame"></iframe>
        <source itemprop="source" src="/s.mp4" />
        <track itemprop="captions" src="/t.vtt" />
        <video itemprop="movie" src="/v.mp4"></video>
        <embed itemprop="plugin" src="/e.swf" />
        <meter itemprop="level" value="0.5"></meter>
        <input itemprop="field" value="typed" />
        <textarea itemprop="note" value="typed-note"></textarea>
        <select itemprop="choice" value="opt"></select>
        <object itemprop="obj" data="/obj.bin"></object>
      `
      const props = get_itemprops(el)
      expect(props.hotspot).toBe('#spot')
      expect(props.canonical).toBe('/canon')
      expect(props.icon).toBe('#sym')
      expect(props.clip).toBe('/a.mp3')
      expect(props.embed).toBe('/frame')
      expect(props.source).toBe('/s.mp4')
      expect(props.captions).toBe('/t.vtt')
      expect(props.movie).toBe('/v.mp4')
      expect(props.plugin).toBe('/e.swf')
      expect(props.level).toBe('0.5')
      expect(props.field).toBe('typed')
      expect(props.note).toBe('typed-note')
      expect(props.choice).toBe('opt')
      expect(props.obj).toContain('obj.bin')
    })

    it('keeps the svg element itself when itemprop is on svg', () => {
      const outer = document.createElement('div')
      outer.setAttribute('itemscope', '')
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('itemprop', 'mark')
      outer.appendChild(svg)
      expect(get_itemprops(outer).mark).toBe(svg)
    })

    it('applies vector dimensions for symbol tags', () => {
      const symbol = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'symbol'
      )
      symbol.setAttribute('itemscope', '')
      symbol.setAttribute('viewBox', '0 0 20 10')
      const props = get_itemprops(symbol)
      expect(props.viewbox).toBe('0 0 20 10')
      expect(props.width).toBe('20')
      expect(props.height).toBe('10')
    })

    it('returns svg geometry elements as element values', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('itemscope', '')
      svg.setAttribute('itemid', '/+1/posters/1')
      svg.setAttribute('viewBox', '0 0 100 50')
      svg.setAttribute('width', '100')
      svg.setAttribute('height', '50')
      const path = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      path.setAttribute('itemprop', 'regular')
      path.setAttribute('d', 'M0 0')
      svg.appendChild(path)

      const props = get_itemprops(svg)
      expect(props.viewbox).toBe('0 0 100 50')
      expect(props.width).toBe('100')
      expect(props.height).toBe('50')
      expect(props.regular).toBe(path)
    })

    it('serializes g and defs as innerHTML', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('itemscope', '')
      svg.setAttribute('viewBox', '0 0 10 10')
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('itemprop', 'layer')
      g.innerHTML = '<path d="M1 1"/>'
      const defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'defs'
      )
      defs.setAttribute('itemprop', 'defs')
      defs.innerHTML = '<rect width="1" height="1"/>'
      const rect = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      )
      rect.setAttribute('itemprop', 'box')
      const stop = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'stop'
      )
      stop.setAttribute('itemprop', 'stop')
      svg.append(g, defs, rect, stop)

      const props = get_itemprops(svg)
      expect(props.layer).toContain('path')
      expect(props.defs).toContain('rect')
      expect(props.box).toBe(rect)
      expect(props.stop).toBe(stop)
    })

    it('trims text content for unknown tags', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `<p itemprop="bio">  hello world  </p>`
      expect(get_itemprops(el).bio).toBe('hello world')
    })

    it('ignores nested itemprops that are not nested itemscope roots', () => {
      const el = document.createElement('div')
      el.setAttribute('itemscope', '')
      el.innerHTML = `
        <div itemscope itemprop="child">
          <span itemprop="secret">hidden</span>
        </div>
        <span itemprop="visible">shown</span>
      `
      const props = get_itemprops(el)
      expect(props.visible).toBe('shown')
      expect(props.child).toMatchObject({ secret: 'hidden' })
      expect(props.secret).toBeUndefined()
    })
  })
})
