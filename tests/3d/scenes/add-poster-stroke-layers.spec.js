import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { parse_poster_svg } from '@/3d/utils/load-svg-layers.js'
import { add_poster_stroke_layers } from '@/3d/scenes/add-poster-stroke-layers.js'

vi.mock('@/3d/utils/load-svg-texture.js', () => ({
  svg_to_canvas_texture: vi.fn()
}))

const fixture_dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const poster_svg = readFileSync(join(fixture_dir, 'poster-layers.svg'), 'utf8')

describe('add_poster_stroke_layers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads static stroke textures for shadow path children', async () => {
    const { svg_to_canvas_texture } =
      await import('@/3d/utils/load-svg-texture.js')
    vi.mocked(svg_to_canvas_texture).mockResolvedValue({
      texture: { dispose: vi.fn() },
      width: 10,
      height: 10
    })

    const root = new THREE.Group()
    const layer_groups = []
    const stroke_entries = []
    const stroke_group_map = new Map()
    const stroke_materials = []

    const promises = add_poster_stroke_layers({
      poster_svg: parse_poster_svg(poster_svg),
      root,
      plane_w: 3.5,
      plane_h: 3.5,
      shadow_spread: 0.1,
      group_gap: 0,
      layer_groups,
      stroke_entries,
      stroke_group_map,
      stroke_materials
    })

    await Promise.all(promises)

    expect(stroke_group_map.has('bold')).toBe(true)
    expect(stroke_group_map.has('light')).toBe(true)
    expect(stroke_materials.every(entry => entry.loaded)).toBe(true)
    expect(layer_groups.every(layer => layer.kind === 'stroke')).toBe(true)
    expect(svg_to_canvas_texture).toHaveBeenCalled()
  })
})
