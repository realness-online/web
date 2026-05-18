import { vi } from 'vite-plus/test'
import * as THREE from 'three'
import { register_viewer } from '@/3d/engine/shared-renderer.js'

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
  }),
  Scene: vi.fn(function () {
    this.children = []
  })
}))

describe('shared_renderer register_viewer', () => {
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
    vi.stubGlobal(
      'IntersectionObserver',
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
      width: 160,
      height: 120,
      left: 0,
      top: 0
    })
    canvas.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalCompositeOperation: 'source-over',
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    }))
    return canvas
  }

  const make_scene_controller = () => ({
    scene: new THREE.Scene(),
    mount: vi.fn(),
    update: vi.fn(),
    on_resize: vi.fn()
  })

  it('mounts scene and sizes canvas on register', () => {
    const canvas = make_canvas()
    const scene_controller = make_scene_controller()
    const viewer = register_viewer(canvas, scene_controller)

    expect(scene_controller.mount).toHaveBeenCalled()
    expect(canvas.width).toBe(160)
    expect(canvas.height).toBe(120)
    viewer.destroy()
  })

  it('start_enter drives svg zoom callback during enter phase', () => {
    const canvas = make_canvas()
    const scene_controller = make_scene_controller()
    const on_svg_zoom = vi.fn()
    const viewer = register_viewer(canvas, scene_controller)

    viewer.start_enter(on_svg_zoom)
    raf_callback(0)
    raf_callback(200)

    expect(on_svg_zoom).toHaveBeenCalled()
    viewer.destroy()
  })

  it('destroy removes viewer from active loop', () => {
    const canvas = make_canvas()
    const scene_controller = make_scene_controller()
    const viewer = register_viewer(canvas, scene_controller)

    viewer.start_enter(vi.fn())
    raf_callback(0)
    expect(render_spy).toHaveBeenCalled()
    viewer.destroy()
    const calls_after_destroy = render_spy.mock.calls.length
    raf_callback(500)

    expect(render_spy.mock.calls.length).toBe(calls_after_destroy)
  })
})
