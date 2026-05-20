import * as THREE from 'three'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { parse_poster_svg } from '@/3d/utils/load-svg-layers.js'
import { add_poster_shadow_layers } from '@/3d/scenes/add-poster-shadow-layers.js'

vi.mock('@/3d/utils/load-svg-texture.js', () => ({
  svg_to_canvas_texture: vi.fn()
}))

const fixture_dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const poster_svg = readFileSync(join(fixture_dir, 'poster-layers.svg'), 'utf8')

describe('add_poster_shadow_layers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads textures for shadow children present in fixture', async () => {
    const { svg_to_canvas_texture } =
      await import('@/3d/utils/load-svg-texture.js')
    vi.mocked(svg_to_canvas_texture).mockResolvedValue({
      texture: { dispose: vi.fn() },
      width: 10,
      height: 10
    })

    const root = new THREE.Group()
    const layer_groups = []
    const shadow_entries = []
    const shadow_group_map = new Map()
    const shadow_materials = []
    const shadow_layer_visible = {}

    const promises = add_poster_shadow_layers({
      poster_svg: parse_poster_svg(poster_svg),
      root,
      plane_w: 3.5,
      plane_h: 3.5,
      shadow_spread: 0.1,
      group_gap: 0,
      shadow_opacity: 1,
      layer_groups,
      shadow_entries,
      shadow_group_map,
      shadow_materials,
      shadow_layer_visible
    })

    await Promise.all(promises)

    expect(shadow_group_map.has('bold')).toBe(true)
    expect(shadow_group_map.has('light')).toBe(true)
    expect(shadow_materials.every(entry => entry.loaded)).toBe(true)
    expect(
      /** @type {THREE.Mesh} */ (root.getObjectByName('shadow-bold')).material
        .opacity
    ).toBe(1)
  })

  it('logs and keeps opacity zero when texture load fails', async () => {
    const { svg_to_canvas_texture } =
      await import('@/3d/utils/load-svg-texture.js')
    vi.mocked(svg_to_canvas_texture).mockRejectedValue(
      new Error('texture fail')
    )
    const error_spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const root = new THREE.Group()
    const promises = add_poster_shadow_layers({
      poster_svg: parse_poster_svg(poster_svg),
      root,
      plane_w: 1,
      plane_h: 1,
      shadow_spread: 0.1,
      group_gap: 0,
      shadow_opacity: 1,
      layer_groups: [],
      shadow_entries: [],
      shadow_group_map: new Map(),
      shadow_materials: [],
      shadow_layer_visible: {}
    })

    await Promise.all(promises)

    expect(error_spy).toHaveBeenCalled()
    error_spy.mockRestore()
  })
})
