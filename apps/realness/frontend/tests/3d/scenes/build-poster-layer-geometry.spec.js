import * as THREE from 'three'
import { vi } from 'vite-plus/test'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { build_poster_layer_geometry } from '@/3d/scenes/build-poster-layer-geometry.js'

describe('build_poster_layer_geometry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('merges svg paths into buffer geometry', () => {
    const square = new THREE.Shape()
    square.moveTo(0, 0)
    square.lineTo(10, 0)
    square.lineTo(10, 10)
    vi.spyOn(SVGLoader, 'createShapes').mockReturnValue([square])
    const paths = [{ color: new THREE.Color(0x000000) }]

    const geometry = build_poster_layer_geometry(paths)

    expect(geometry).not.toBeNull()
    expect(geometry.attributes.position.count).toBeGreaterThan(0)
    expect(geometry.attributes.color).toBeDefined()
  })

  it('returns null when paths are empty', () => {
    expect(build_poster_layer_geometry([])).toBeNull()
  })
})
