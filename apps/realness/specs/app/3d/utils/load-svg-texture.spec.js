import * as THREE from 'three'
import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { svg_to_canvas_texture } from '@/3d/utils/load-svg-texture.js'

describe('svg_to_canvas_texture', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves canvas texture from svg text', async () => {
    const draw_image = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas')
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: draw_image })
        }
      return document.createElement(tag)
    })

    class FakeImage {
      constructor() {
        this.naturalWidth = 50
        this.naturalHeight = 40
        setTimeout(() => this.onload?.(), 0)
      }
      set src(_value) {}
    }
    vi.stubGlobal('Image', FakeImage)

    const { texture, width, height } = await svg_to_canvas_texture(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 40"></svg>'
    )

    expect(texture).toBeInstanceOf(THREE.CanvasTexture)
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(width).toBe(100)
    expect(height).toBe(80)
    expect(draw_image).toHaveBeenCalled()
    texture.dispose()
  })

  it('caps the raster at max_dimension and honours background and color space', async () => {
    const draw_image = vi.fn()
    const fill_rect = vi.fn()
    const ctx = { drawImage: draw_image, fillRect: fill_rect, fillStyle: '' }
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas')
        return { width: 0, height: 0, getContext: () => ctx }
      return document.createElement(tag)
    })

    class FakeImage {
      constructor() {
        this.naturalWidth = 512
        this.naturalHeight = 588
        setTimeout(() => this.onload?.(), 0)
      }
      set src(_value) {}
    }
    vi.stubGlobal('Image', FakeImage)

    const { texture, width, height } = await svg_to_canvas_texture('<svg />', {
      max_dimension: 256,
      background: '#000',
      color_space: THREE.NoColorSpace
    })

    expect(height).toBe(256)
    expect(width).toBe(223)
    expect(ctx.fillStyle).toBe('#000')
    expect(fill_rect).toHaveBeenCalledWith(0, 0, width, height)
    expect(texture.colorSpace).toBe(THREE.NoColorSpace)
    texture.dispose()
  })

  it('leaves a raster smaller than max_dimension at full density', async () => {
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      if (tag === 'canvas')
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() })
        }
      return document.createElement(tag)
    })

    class FakeImage {
      constructor() {
        this.naturalWidth = 50
        this.naturalHeight = 40
        setTimeout(() => this.onload?.(), 0)
      }
      set src(_value) {}
    }
    vi.stubGlobal('Image', FakeImage)

    const { texture, width } = await svg_to_canvas_texture('<svg />', {
      max_dimension: 256
    })

    expect(width).toBe(100)
    texture.dispose()
  })

  it('rejects when image fails to load', async () => {
    class BadImage {
      constructor() {
        setTimeout(() => this.onerror?.(new Error('load failed')), 0)
      }
      set src(_value) {}
    }
    vi.stubGlobal('Image', BadImage)

    await expect(svg_to_canvas_texture('<svg></svg>')).rejects.toThrow()
  })
})
