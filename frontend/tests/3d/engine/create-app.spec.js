import { vi } from 'vite-plus/test'
import * as THREE from 'three'
import { create_app } from '@/3d/engine/create-app.js'
import {
  CAMERA_DISTANCE,
  RENDERER_CLEAR_ALPHA,
  RENDERER_CLEAR_COLOR
} from '@/3d/engine/renderer-config.js'

const render_spy = vi.fn()

vi.mock('three', () => ({
  WebGLRenderer: vi.fn(function () {
    this.domElement = document.createElement('canvas')
    this.setPixelRatio = vi.fn()
    this.setClearColor = vi.fn()
    this.setSize = vi.fn()
    this.render = render_spy
  }),
  PerspectiveCamera: vi.fn(function () {
    this.position = { set: vi.fn() }
    this.aspect = 1
    this.updateProjectionMatrix = vi.fn()
  })
}))

describe('create_app', () => {
  let raf_callback = null

  beforeEach(() => {
    render_spy.mockClear()
    raf_callback = null
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(callback => {
        raf_callback = callback
        return 1
      })
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function () {
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn()
        }
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const make_canvas = () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({
      width: 320,
      height: 240,
      left: 0,
      top: 0
    })
    return canvas
  }

  const make_scene_controller = () => ({
    scene: {},
    mount: vi.fn(),
    update: vi.fn(),
    on_resize: vi.fn()
  })

  it('configures renderer and camera on create', () => {
    const canvas = make_canvas()
    const app = create_app({ canvas })
    const renderer = app.get_renderer()

    expect(renderer.setClearColor).toHaveBeenCalledWith(
      RENDERER_CLEAR_COLOR,
      RENDERER_CLEAR_ALPHA
    )
    const camera = THREE.PerspectiveCamera.mock.results[0].value
    expect(camera.position.set).toHaveBeenCalledWith(0, 0, CAMERA_DISTANCE)
  })

  it('mount_scene wires controller and renders on tick', () => {
    const canvas = make_canvas()
    const app = create_app({ canvas })
    const scene_controller = make_scene_controller()

    app.mount_scene(scene_controller)
    app.start()
    raf_callback(1000)
    raf_callback(1032)

    expect(scene_controller.mount).toHaveBeenCalled()
    expect(scene_controller.update).toHaveBeenCalled()
    expect(render_spy).toHaveBeenCalledWith(
      scene_controller.scene,
      expect.anything()
    )
  })

  it('notifies frame listeners', () => {
    const canvas = make_canvas()
    const app = create_app({ canvas })
    const on_frame = vi.fn()

    app.on_frame(on_frame)
    app.start()
    raf_callback(1000)

    expect(on_frame).toHaveBeenCalledWith(
      expect.objectContaining({ now_ms: 1000 })
    )
  })
})
