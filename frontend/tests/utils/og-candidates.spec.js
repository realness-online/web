import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import {
  OG_WIDTH,
  OG_HEIGHT,
  candidate_filename,
  draw_og_card,
  ensure_og_fonts,
  resolve_css_color,
  landscape_posters
} from '@/utils/og-candidates'

const recording_context = () => {
  const calls = []
  const gradient = { addColorStop: vi.fn() }
  return {
    calls,
    createLinearGradient: (...args) => {
      calls.push(['createLinearGradient', ...args])
      return gradient
    },
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    measureText: text => ({ width: text.length }),
    beginPath: () => calls.push(['beginPath']),
    roundRect: (...args) => calls.push(['roundRect', ...args]),
    fill: () => calls.push(['fill']),
    set fillStyle(value) {
      calls.push(['fillStyle', value])
    },
    set font(value) {
      calls.push(['font', value])
    },
    set textAlign(value) {
      calls.push(['textAlign', value])
    },
    set textBaseline(value) {
      calls.push(['textBaseline', value])
    }
  }
}

const copy = {
  headline: 'Realness Online',
  subhead: 'Rotoscope photos into layered SVG posters',
  cta: 'Make some posters today',
  accent: 'rgb(1, 2, 3)',
  contrast: 'rgb(255, 255, 255)'
}

describe('@/utils/og-candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a chained css custom property via the probe element', () => {
    const probe_color = 'rgb(1, 2, 3)'
    const original_computed = globalThis.getComputedStyle
    globalThis.getComputedStyle = el => ({ color: probe_color })
    try {
      expect(resolve_css_color('--accent')).toBe(probe_color)
    } finally {
      globalThis.getComputedStyle = original_computed
    }
  })

  it('skips font loading when the document exposes no font faces', async () => {
    // happy-dom: document.fonts is undefined, so the guard returns early
    await expect(ensure_og_fonts()).resolves.toBeUndefined()
  })

  it('loads the headline and subhead webfaces when fonts are available', async () => {
    const loads = []
    const fonts = {
      load: vi.fn(font => {
        loads.push(font)
        return Promise.resolve()
      }),
      ready: Promise.resolve()
    }
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts
    })
    await expect(ensure_og_fonts()).resolves.toBeUndefined()
    expect(loads).toHaveLength(2)
    expect(loads[0]).toContain('bold 60px Lato')
    expect(loads[1]).toContain('34px Lato')
    delete document.fonts
  })

  it('frames candidates at the open graph aspect ratio', () => {
    expect(OG_WIDTH).toBe(1200)
    expect(OG_HEIGHT).toBe(630)
  })

  it('keeps only landscape posters', () => {
    const items = [
      { id: '/+1/posters/1', viewbox: '0 0 512 683' },
      { id: '/+1/posters/2', viewbox: '0 0 683 512' },
      { id: '/+1/posters/3', viewbox: '0 0 1024 768' },
      { id: '/+1/posters/4' }
    ]
    expect(landscape_posters(items).map(item => item.id)).toEqual([
      '/+1/posters/2',
      '/+1/posters/3'
    ])
  })

  it('names a candidate after its poster and style', () => {
    expect(candidate_filename('/+16282281824/posters/1775512190351', 'card')) //
      .toBe('1775512190351-card.jpg')
  })

  it('draws card copy bottom up, inside the frame', () => {
    const ctx = recording_context()
    draw_og_card(ctx, copy)

    const texts = ctx.calls.filter(([method]) => method === 'fillText')
    expect(texts.map(([, text]) => text)).toEqual([
      copy.cta,
      copy.subhead,
      copy.headline
    ])

    const baselines = texts.map(([, , , y]) => y)
    expect(baselines[0]).toBeGreaterThan(baselines[1])
    expect(baselines[1]).toBeGreaterThan(baselines[2])
    baselines.forEach(y => {
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(OG_HEIGHT)
    })
  })

  it('scrims the whole frame before drawing copy', () => {
    const ctx = recording_context()
    draw_og_card(ctx, copy)
    const scrim = ctx.calls.find(([method]) => method === 'fillRect')
    expect(scrim).toEqual(['fillRect', 0, 0, OG_WIDTH, OG_HEIGHT])
    expect(ctx.calls.indexOf(scrim)).toBeLessThan(
      ctx.calls.findIndex(([method]) => method === 'fillText')
    )
  })

  it('sizes the call to action pill around its text', () => {
    const ctx = recording_context()
    draw_og_card(ctx, copy)
    const [, x, , width] = ctx.calls.find(([method]) => method === 'roundRect')
    expect(width).toBeGreaterThan(copy.cta.length)
    expect(x + width).toBeLessThan(OG_WIDTH)
  })
})
