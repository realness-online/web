import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  build_download_svg,
  get_filename_for_poster,
  prepare_poster_svg_for_3d
} from '@/utils/export-poster'
import { geology_layers } from '@/use/poster'

vi.mock('@/utils/poster-canvas', () => ({
  merge_poster_hidden_symbols: vi.fn()
}))

vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(() => 1720119797893),
  load: vi.fn(() => Promise.resolve({ name: 'Ada' })),
  as_layer_id: vi.fn((itemid, layer) => `${itemid}/${layer}`)
}))

vi.mock('@/utils/date', () => ({
  as_day_time_of_day_for_filename: vi.fn(() => 'Monday morning, May 18')
}))

const make_svg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('itemtype', '/posters')
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  const hidden = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  hidden.setAttribute('style', 'visibility: hidden')
  const animation = document.createElement('as-animation')
  const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
  stop.setAttribute('id', 'layer-old')
  stop.setAttribute('itemprop', 'shadow')
  stop.setAttribute('stop-color', '#336699')
  svg.append(defs, hidden, animation, stop)
  return svg
}

describe('@/utils/export-poster', () => {
  beforeEach(() => {
    localStorage.removeItem('adobe')
  })

  describe('build_download_svg', () => {
    it('clones svg, strips hidden nodes and vue animation tags', () => {
      const source = make_svg()
      const result = build_download_svg(source)

      expect(result).not.toBe(source)
      expect(result.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg')
      expect(result.querySelector('[style*="visibility: hidden"]')).toBeNull()
      expect(result.querySelector('as-animation')).toBeNull()
      expect(result.querySelector('#shadow')).not.toBeNull()
    })

    it('runs adobe gradient conversion when localStorage.adobe is set', () => {
      localStorage.adobe = '1'
      const source = make_svg()
      const stop = source.querySelector('stop')
      stop?.setAttribute('stop-color', 'oklch(0.55 0.12 240)')
      const result = build_download_svg(source)

      expect(result.querySelector('stop')?.getAttribute('stop-color')).toMatch(
        /^#/
      )
    })

    it('strips composition grid overlay from exports', () => {
      const source = make_svg()
      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      grid.setAttribute('data-grid-overlay', '')
      grid.innerHTML = '<line x1="0" y1="10" x2="100" y2="10"></line>'
      source.appendChild(grid)

      const result = build_download_svg(source)

      expect(result.querySelector('g[data-grid-overlay]')).toBeNull()
    })
  })

  describe('get_filename_for_poster', () => {
    it('includes creator name when load returns a person', async () => {
      const itemid = /** @type {import('@/types').Id} */ (
        '/+15551234567/posters/1720119797893'
      )
      const name = await get_filename_for_poster(itemid, 'svg')
      expect(name).toContain('Ada @')
      expect(name).toContain('.svg')
    })

    it('falls back when created_at is missing', async () => {
      const { as_created_at } = await import('@/utils/itemid')
      as_created_at.mockReturnValueOnce(null)
      const name = await get_filename_for_poster(
        /** @type {import('@/types').Id} */ ('/+1/posters/x'),
        'png'
      )
      expect(name).toBe('poster.png')
    })
  })

  describe('prepare_poster_svg_for_3d', () => {
    it('returns serialized svg without symbol defs when figure is missing', async () => {
      const svg = make_svg()
      const out = await prepare_poster_svg_for_3d(
        svg,
        /** @type {import('@/types').Id} */ ('/+1/posters/1'),
        { wait_for_symbols: false }
      )
      expect(out).toContain('<svg')
      expect(out).not.toContain('as-animation')
    })

    it('clones geology symbols into defs when figure provides them', async () => {
      const figure = document.createElement('figure')
      const poster_svg = make_svg()
      const symbol_defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      )
      symbol_defs.setAttribute('data-poster-symbol-defs', '')
      const layer = geology_layers[0]
      const symbol = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'symbol'
      )
      symbol.setAttribute('itemid', `/+1/posters/1/${layer}`)
      symbol.innerHTML = '<path d="M0 0 L1 1" />'
      symbol_defs.appendChild(symbol)
      figure.append(poster_svg, symbol_defs)
      document.body.append(figure)

      const out = await prepare_poster_svg_for_3d(
        poster_svg,
        /** @type {import('@/types').Id} */ ('/+1/posters/1'),
        { wait_for_symbols: false }
      )

      expect(out).toContain(`id="${layer}"`)
    })

    it('waits for shadow background fill before serializing', async () => {
      const figure = document.createElement('figure')
      const poster_svg = make_svg()
      const symbol_defs = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      )
      symbol_defs.setAttribute('data-poster-symbol-defs', '')
      const shadow_symbol = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'symbol'
      )
      shadow_symbol.setAttribute('itemid', '/+1/posters/1/shadows')
      const background = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
      )
      background.setAttribute('itemprop', 'background')
      shadow_symbol.appendChild(background)
      symbol_defs.appendChild(shadow_symbol)
      figure.append(poster_svg, symbol_defs)
      document.body.append(figure)

      let fill_set = false
      const prepared = prepare_poster_svg_for_3d(
        poster_svg,
        /** @type {import('@/types').Id} */ ('/+1/posters/1')
      )

      requestAnimationFrame(() => {
        background.setAttribute('fill', 'url(#radial-background)')
        fill_set = true
      })

      await prepared
      expect(fill_set).toBe(true)
    })
  })
})
