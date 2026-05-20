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
