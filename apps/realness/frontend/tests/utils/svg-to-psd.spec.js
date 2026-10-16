import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  render_svg_layers_to_psd,
  extract_all_layers
} from '@/utils/svg-to-psd'

const { mock_write_psd, mock_merge_symbols } = vi.hoisted(() => ({
  mock_write_psd: vi.fn(() => new ArrayBuffer(8)),
  mock_merge_symbols: vi.fn()
}))

vi.mock('ag-psd', () => ({ writePsd: mock_write_psd }))

vi.mock('@/utils/poster-canvas', () => ({
  merge_poster_hidden_symbols: mock_merge_symbols
}))

vi.mock('@/utils/itemid', () => ({
  as_layer_id: vi.fn((poster_id, layer) => `${poster_id}/${layer}`),
  as_query_id: vi.fn(id => String(id).replace(/\//g, '-')),
  as_fragment_id: vi.fn(id => `#${String(id).replace(/\//g, '-')}`)
}))

const poster_id = '/+14151234356/posters/1720119797893'
const shadow_query_id = `${poster_id}/shadows`.replace(/\//g, '-')

const SVG_NS = 'http://www.w3.org/2000/svg'
const create = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, value)
  return element
}

/**
 * A poster carrying a shadow symbol with every core layer, plus one cutout
 * symbol, which is the shape the exporter reads. Noise elements exercise the
 * clone cleanup.
 */
const make_poster = ({ with_cutouts = true } = {}) => {
  const svg = create('svg', { width: '100', height: '100' })
  svg.setAttribute('viewBox', '0 0 100 50')

  const defs = create('defs')
  const shadows = create('symbol', { id: shadow_query_id })
  for (const name of ['background', 'light', 'regular', 'medium', 'bold']) {
    const path = create('path', {
      itemprop: name,
      stroke: '#000',
      'stroke-opacity': '1'
    })
    if (name === 'light') path.setAttribute('stroke-opacity', '0')
    shadows.appendChild(path)
  }
  defs.appendChild(shadows)

  const hidden = create('g', { style: 'visibility: hidden' })
  const animation = document.createElement('as-animation')
  const lightbar = create('rect', { id: 'lightbar-1' })

  svg.append(defs, hidden, animation, lightbar)

  const shadow_use = create('use', {
    href: `#${shadow_query_id}`,
    itemprop: 'shadows'
  })
  svg.appendChild(shadow_use)

  if (with_cutouts) {
    const cutout_query_id = `${poster_id}/sediment`.replace(/\//g, '-')
    const cutout_symbol = create('symbol', { id: cutout_query_id })
    cutout_symbol.appendChild(
      create('path', { d: 'M0 0 L1 1', 'fill-opacity': '0.5' })
    )
    defs.appendChild(cutout_symbol)
    svg.appendChild(
      create('use', {
        href: `#${cutout_query_id}`,
        itemprop: 'sediment'
      })
    )
  }

  document.body.appendChild(svg)
  return svg
}

const raster_stubs = () => {
  class StubCanvas {
    constructor(width, height) {
      this.width = width
      this.height = height
    }
    getContext() {
      return {
        drawImage: vi.fn(),
        getImageData: vi.fn((_x, _y, width, height) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height
        }))
      }
    }
  }
  global.OffscreenCanvas = StubCanvas
  global.XMLSerializer = class {
    serializeToString() {
      return '<svg></svg>'
    }
  }
  global.URL.createObjectURL = vi.fn(() => 'blob:poster')
  global.URL.revokeObjectURL = vi.fn()
  global.Image = class {
    set src(value) {
      this._src = value
      if (this.onload) this.onload()
    }
    get src() {
      return this._src || ''
    }
  }
}

describe('@/utils/svg-to-psd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_write_psd.mockReturnValue(new ArrayBuffer(8))
    raster_stubs()
    document.body.innerHTML = ''
  })

  describe('extract_all_layers', () => {
    it('keeps core layers and one cutout, in file order', async () => {
      const poster = make_poster()

      const layers = await extract_all_layers(poster, poster_id)

      const names = layers.map(layer => layer.name)
      expect(names).toEqual([
        'Background',
        'Light',
        'Regular',
        'Medium',
        'Bold',
        'Sediment'
      ])
      expect(mock_merge_symbols).toHaveBeenCalled()
      expect(layers[0].opacity).toBe(1)
      expect(layers[1].opacity).toBe(0.9)
      expect(layers.at(-1).opacity).toBe(0.5)
      expect(mock_merge_symbols).toHaveBeenCalled()
    })

    it('scales to the given width and keeps the aspect ratio', async () => {
      const poster = make_poster()
      let seen_width

      global.OffscreenCanvas = class {
        constructor(width, height) {
          seen_width = width
          this.height = height
        }
        getContext() {
          return {
            drawImage: vi.fn(),
            getImageData: vi.fn((_x, _y, width, height) => ({
              data: new Uint8ClampedArray(width * height * 4),
              width,
              height
            }))
          }
        }
      }

      await extract_all_layers(poster, poster_id, 800)

      expect(seen_width).toBe(800)
    })

    it('narrows the raster on iOS', async () => {
      const iphone_agent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iphone_agent)
      vi.resetModules()
      const { render_svg_layers_to_psd: render_on_ios } =
        await import('@/utils/svg-to-psd')
      const poster = make_poster()

      await render_on_ios(poster, poster_id)

      const psd = mock_write_psd.mock.calls.at(-1)[0]
      expect(psd.width).toBe(1920)
      expect(psd.height).toBe(960)
    })

    it('returns no layers when the poster has neither shadows nor cutouts', async () => {
      const empty = create('svg')
      empty.setAttribute('viewBox', '0 0 10 10')
      document.body.appendChild(empty)

      expect(await extract_all_layers(empty, poster_id)).toEqual([])
    })
  })

  describe('render_svg_layers_to_psd', () => {
    it('writes a PSD with shadow, stroke, and mosaic groups', async () => {
      const poster = make_poster()

      const result = await render_svg_layers_to_psd(poster, poster_id)

      expect(result).toBeInstanceOf(Uint8Array)
      const psd = mock_write_psd.mock.calls[0][0]
      expect(psd.children.map(group => group.name)).toEqual([
        'Shadows',
        'Stroke',
        'Mosaic'
      ])
      expect(psd.children[0].children.map(layer => layer.name)).toContain(
        'Regular'
      )
      expect(psd.children[2].children.map(layer => layer.name)).toEqual([
        'Sediment'
      ])
      expect(mock_merge_symbols).toHaveBeenCalledWith(
        expect.anything(),
        poster,
        expect.any(Function)
      )
    })

    it('refuses to export a poster with nothing to draw', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const empty = create('svg')
      empty.setAttribute('viewBox', '0 0 10 10')
      document.body.appendChild(empty)

      await expect(render_svg_layers_to_psd(empty, poster_id)).rejects.toThrow(
        'No layers found to export'
      )
      expect(error).toHaveBeenCalledWith(
        '[PSD Generation] No layers found to export'
      )
      error.mockRestore()
    })

    it('omits the stroke group when no stroke layer survives', async () => {
      const poster = make_poster()
      poster
        .querySelector(`symbol[id="${shadow_query_id}"]`)
        .querySelectorAll('[itemprop]')
        .forEach(path => {
          path.setAttribute('stroke', 'none')
          path.setAttribute('fill', 'none')
        })

      await render_svg_layers_to_psd(poster, poster_id)

      const psd = mock_write_psd.mock.calls[0][0]
      expect(psd.children.map(group => group.name)).toEqual([
        'Shadows',
        'Mosaic'
      ])
    })
  })
})
