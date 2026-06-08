import * as THREE from 'three'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { export_poster_glb } from '@/3d/scenes/export-poster-glb.js'

const { parse_mock } = vi.hoisted(() => ({
  parse_mock: vi.fn((scene, on_done) => {
    on_done(new ArrayBuffer(8))
  })
}))

vi.mock('three/addons/exporters/GLTFExporter.js', () => ({
  GLTFExporter: class {
    parse(scene, on_done) {
      parse_mock(scene, on_done)
    }
  }
}))

describe('export_poster_glb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:glb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('exports colored mosaic meshes and textured shadows', () => {
    const scene = new THREE.Scene()
    add_poster_scene_lights(scene)

    const mosaic_geo = new THREE.BufferGeometry()
    const colors = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0])
    mosaic_geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    mosaic_geo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(9), 3)
    )
    const mosaic = new THREE.Mesh(
      mosaic_geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true })
    )
    mosaic.name = 'boulders'
    scene.add(mosaic)

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
        map: new THREE.Texture()
      })
    )
    shadow.name = 'shadow-bold'
    scene.add(shadow)

    const anchor = { click: vi.fn(), href: '', download: '' }
    const create_spy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(tag => {
        if (tag === 'a')
          return /** @type {HTMLAnchorElement} */ (
            /** @type {unknown} */ (anchor)
          )
        return Document.prototype.createElement.call(document, tag)
      })

    export_poster_glb(scene, 'test-poster')

    expect(parse_mock).toHaveBeenCalled()
    const export_scene = parse_mock.mock.calls[0][0]
    expect(export_scene.getObjectByName('mosaic').children.length).toBe(1)
    expect(export_scene.getObjectByName('shadows').children.length).toBe(1)
    expect(anchor.download).toBe('test-poster.glb')
    expect(anchor.click).toHaveBeenCalled()

    const mosaic_mesh = export_scene.getObjectByName('mosaic').children[0]
    expect(mosaic_mesh.material.map).toBeInstanceOf(THREE.DataTexture)
    expect(mosaic_mesh.material.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(mosaic_mesh.material.vertexColors).toBe(false)
    expect(mosaic_mesh.geometry.attributes.color).toBeUndefined()
    expect(mosaic_mesh.geometry.attributes.uv).toBeDefined()

    create_spy.mockRestore()
  })
})

/** @param {THREE.Scene} scene */
const add_poster_scene_lights = scene => {
  scene.add(new THREE.AmbientLight(0xffffff, 1))
  const key = new THREE.DirectionalLight(0xffffff, 1)
  key.position.set(0, 4, 6)
  scene.add(key)
}
