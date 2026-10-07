import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  merge_poster_hidden_symbols,
  render_complete_poster_to_canvas
} from '@/utils/poster-canvas'

// Build a poster structure: a figure wrapping a `<svg itemtype>` root plus a
// hidden companion `<svg data-poster-symbol-defs>` holding `<symbol>`s.
const make_figure = ({ with_defs = true, with_symbols = true } = {}) => {
  const figure = document.createElement('figure')
  const svg_root = document.createElement('svg')
  svg_root.setAttribute('itemtype', '/posters')
  figure.appendChild(svg_root)
  if (with_defs) svg_root.innerHTML = '<defs></defs>'
  if (with_symbols) {
    const hidden = document.createElement('svg')
    hidden.setAttribute('data-poster-symbol-defs', '')
    hidden.innerHTML =
      '<symbol id="sym-a"></symbol><symbol id="sym-b"></symbol>'
    figure.appendChild(hidden)
  }
  document.body.appendChild(figure)
  return { figure, svg_root }
}

describe('@/utils/poster-canvas merge_poster_hidden_symbols', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns early when the element is not inside a poster figure', () => {
    const svg_root = document.createElement('svg')
    svg_root.setAttribute('itemtype', '/posters')
    document.body.appendChild(svg_root)
    const include = vi.fn()
    merge_poster_hidden_symbols(svg_root, svg_root, include)
    expect(include).not.toHaveBeenCalled()
  })

  it('does nothing when the figure has no hidden symbol defs', () => {
    const { svg_root } = make_figure({ with_symbols: false })
    const include = vi.fn()
    merge_poster_hidden_symbols(svg_root, svg_root, include)
    expect(include).not.toHaveBeenCalled()
  })

  it('does nothing when the clone has no defs node', () => {
    const { svg_root } = make_figure({ with_defs: false })
    const include = vi.fn()
    merge_poster_hidden_symbols(svg_root, svg_root, include)
    expect(include).not.toHaveBeenCalled()
  })

  it('appends cloned symbols when include_symbol returns true', () => {
    const { figure, svg_root } = make_figure()
    const include = vi.fn(() => true)
    merge_poster_hidden_symbols(svg_root, svg_root, include)
    const defs = svg_root.querySelector('defs')
    expect(include).toHaveBeenCalledTimes(2)
    expect(defs.querySelectorAll('symbol')).toHaveLength(2)
    expect(figure.parentNode).not.toBeNull()
  })

  it('skips symbols the include callback rejects', () => {
    const { svg_root } = make_figure()
    const include = vi.fn(id => id === 'sym-b')
    merge_poster_hidden_symbols(svg_root, svg_root, include)
    const defs = svg_root.querySelector('defs')
    const added = [...defs.querySelectorAll('symbol')].map(s => s.id)
    expect(added).toEqual(['sym-b'])
  })
})

describe('@/utils/poster-canvas render_complete_poster_to_canvas', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('rasterizes a cloned poster to an offscreen canvas', async () => {
    const draw = vi.fn()
    const canvas = {
      getContext: vi.fn(() => ({ drawImage: draw }))
    }
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(w, h) {
          this.w = w
          this.h = h
        }
        getContext() {
          return { drawImage: draw }
        }
      }
    )
    vi.stubGlobal(
      'Image',
      class {
        set src(v) {
          queueMicrotask(() => this.onload && this.onload())
        }
      }
    )
    const urls = []
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(b => {
        urls.push(b)
        return 'blob:mock'
      }),
      revokeObjectURL: vi.fn()
    })

    const { svg_root } = make_figure()
    const result = await render_complete_poster_to_canvas(svg_root, 100, 50)
    expect(result.w).toBe(100)
    expect(result.h).toBe(50)
    expect(draw).toHaveBeenCalled()
    expect(urls).toHaveLength(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('throws when the 2d context is unavailable', async () => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null
        }
      }
    )
    vi.stubGlobal(
      'Image',
      class {
        set src(v) {
          queueMicrotask(() => this.onload && this.onload())
        }
      }
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn()
    })
    const { svg_root } = make_figure()
    await expect(
      render_complete_poster_to_canvas(svg_root, 100, 50)
    ).rejects.toThrow('2d canvas context')
  })
})
