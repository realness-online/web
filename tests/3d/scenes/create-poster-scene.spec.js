import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { create_poster_scene } from '@/3d/scenes/create-poster-scene.js'

vi.mock('@/3d/scenes/build-poster-layer-geometry.js', () => ({
  build_poster_layer_geometry: vi.fn(() => new THREE.BufferGeometry())
}))

vi.mock('@/3d/utils/load-svg-layers.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    parse_svg_layers_from_context: vi.fn(() => ({
      width: 100,
      height: 100,
      layers: [
        { name: 'boulders', paths: [{}] },
        { name: 'rocks', paths: [{}] }
      ]
    }))
  }
})

vi.mock('@/3d/utils/load-svg-texture.js', () => ({
  svg_to_canvas_texture: vi.fn(() =>
    Promise.resolve({
      texture: { dispose: vi.fn() },
      width: 64,
      height: 64
    })
  )
}))

const fixture_dir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const poster_svg = readFileSync(join(fixture_dir, 'poster-layers.svg'), 'utf8')

describe('create_poster_scene', () => {
  /** @type {ReturnType<typeof create_poster_scene>} */
  let controller

  beforeEach(() => {
    controller = create_poster_scene(poster_svg)
  })

  it('builds scene with fog, root group, and mosaic meshes from fixture', () => {
    expect(controller.scene).toBeInstanceOf(THREE.Scene)
    expect(controller.scene.fog).toBeInstanceOf(THREE.FogExp2)
    expect(controller.scene.getObjectByName('mosaic_boulders')).toBeTruthy()
    expect(controller.scene.getObjectByName('mosaic_rocks')).toBeTruthy()
    expect(controller.scene.children.some(c => c.type === 'AmbientLight')).toBe(
      true
    )
  })

  it('hides mosaic layer when mosaic_visible and per-layer flags disagree', () => {
    controller.set_mosaic_layer_visible('boulders', true)
    controller.set_mosaic_layer_visible('boulders', false)

    const group = controller.scene.getObjectByName('mosaic_boulders')
    expect(group.visible).toBe(false)

    controller.set_mosaic_layer_visible('boulders', true)
    expect(group.visible).toBe(true)
  })

  it('hides all mosaic when mosaic_visible is false even if layer flag is true', () => {
    controller.set_mosaic_layer_visible('rocks', true)
    controller.set_mosaic_visible(false)

    expect(controller.scene.getObjectByName('mosaic_rocks').visible).toBe(false)

    controller.set_mosaic_visible(true)
    expect(controller.scene.getObjectByName('mosaic_rocks').visible).toBe(true)
  })

  it('updates mosaic spread z spacing when set_mosaic_spread changes', () => {
    const boulders = controller.scene.getObjectByName('mosaic_boulders')
    const rocks = controller.scene.getObjectByName('mosaic_rocks')

    controller.set_mosaic_spread(0)
    expect(boulders.position.z).toBe(0)
    expect(rocks.position.z).toBe(0)

    controller.set_mosaic_spread(0.5)

    expect(rocks.position.z).toBeGreaterThan(boulders.position.z)
    expect(boulders.position.z).toBe(0)
  })

  it('applies shadow opacity after textures resolve', async () => {
    await controller.wait_for_textures()

    const bold_mesh = controller.scene.getObjectByName('shadow-bold')
    expect(bold_mesh.material.opacity).toBeGreaterThan(0)

    controller.set_shadow_opacity(0.25)
    expect(bold_mesh.material.opacity).toBeCloseTo(0.25, 2)
  })

  it('wait_for_textures resolves shadow layer promises', async () => {
    const { svg_to_canvas_texture } =
      await import('@/3d/utils/load-svg-texture.js')
    await controller.wait_for_textures()
    expect(svg_to_canvas_texture).toHaveBeenCalled()
  })

  it('wait_for_textures rejects when a shadow texture fails', async () => {
    const { svg_to_canvas_texture } =
      await import('@/3d/utils/load-svg-texture.js')
    vi.mocked(svg_to_canvas_texture).mockRejectedValue(
      new Error('texture fail')
    )
    const error_spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing_controller = create_poster_scene(poster_svg)

    await expect(failing_controller.wait_for_textures()).rejects.toThrow(
      'texture fail'
    )

    vi.mocked(svg_to_canvas_texture).mockResolvedValue({
      texture: { dispose: vi.fn() },
      width: 64,
      height: 64
    })
    error_spy.mockRestore()
  })

  it('mount enables zoom anchor raycast when camera is provided', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 5
    controller.mount({ camera })
    controller.on_resize({ height: 600 })
    controller.update(
      { elapsed_s: 0 },
      {
        pointer_x_norm: 0,
        pointer_y_norm: 0,
        pointer_dx: 0,
        pointer_dy: 0,
        pan_wheel_x: 0,
        pan_wheel_y: 0,
        wheel_delta: -100,
        shift_held: false,
        alt_held: false,
        cmd_held: false,
        arrow_x: 0,
        arrow_y: 0,
        gyro_x: 0,
        gyro_y: 0
      }
    )
    expect(controller.scene.children.length).toBeGreaterThan(0)
  })

  it('get_settings returns current preference snapshot', () => {
    controller.set_mosaic_spread(0.42)
    const settings = controller.get_settings()
    expect(settings.mosaic_spread).toBe(0.42)
  })
})
