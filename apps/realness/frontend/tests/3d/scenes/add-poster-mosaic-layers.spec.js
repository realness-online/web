import * as THREE from 'three'
import { describe, it, expect, vi } from 'vite-plus/test'
import { add_poster_mosaic_layers } from '@/3d/scenes/add-poster-mosaic-layers.js'
import { build_poster_layer_geometry } from '@/3d/scenes/build-poster-layer-geometry.js'

vi.mock('@/3d/scenes/build-poster-layer-geometry.js', () => ({
  build_poster_layer_geometry: vi.fn()
}))

describe('add_poster_mosaic_layers', () => {
  it('skips layers with no geometry', () => {
    build_poster_layer_geometry.mockReturnValue(null)
    const root = new THREE.Group()
    const layer_groups = []
    const mosaic_group_map = new Map()
    const mosaic_materials = []
    const mosaic_layer_visible = {}

    add_poster_mosaic_layers({
      root,
      layers: [{ name: 'boulders', paths: [] }],
      width: 100,
      height: 100,
      scale: 0.035,
      layer_groups,
      mosaic_group_map,
      mosaic_materials,
      mosaic_layer_visible
    })

    expect(root.children.length).toBe(0)
    expect(layer_groups.length).toBe(0)
  })

  it('adds mesh groups for layers with geometry', () => {
    const geometry = new THREE.BufferGeometry()
    build_poster_layer_geometry.mockReturnValue(geometry)
    const root = new THREE.Group()
    const layer_groups = []
    const mosaic_group_map = new Map()
    const mosaic_materials = []
    const mosaic_layer_visible = {}

    add_poster_mosaic_layers({
      root,
      layers: [{ name: 'rocks', paths: [{}] }],
      width: 100,
      height: 100,
      scale: 0.035,
      layer_groups,
      mosaic_group_map,
      mosaic_materials,
      mosaic_layer_visible
    })

    expect(root.children.length).toBe(1)
    expect(root.children[0].name).toBe('mosaic_rocks')
    expect(mosaic_layer_visible.rocks).toBe(true)
    expect(mosaic_materials[0].base_opacity).toBe(0.95)
    geometry.dispose()
  })
})
