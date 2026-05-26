import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vite-plus/test'
import { as_query_id } from '@/utils/itemid'
import as_viewer_3d from '@/components/posters/as-viewer-3d.vue'

const { mock_viewer, mock_scene } = vi.hoisted(() => {
  const scene = {
    set_mosaic_visible: vi.fn(),
    set_shadow_visible: vi.fn(),
    set_stroke_visible: vi.fn(),
    set_mosaic_spread: vi.fn(),
    set_mosaic_opacity: vi.fn(),
    set_shadow_spread: vi.fn(),
    set_shadow_opacity: vi.fn(),
    set_group_gap: vi.fn(),
    set_tilt_amount: vi.fn(),
    set_gyro_amount: vi.fn(),
    set_haze_enabled: vi.fn(),
    set_haze_color: vi.fn(),
    set_haze_density: vi.fn(),
    set_mosaic_layer_visible: vi.fn(),
    set_shadow_layer_visible: vi.fn(),
    set_motion_enabled: vi.fn(),
    set_drift_amount: vi.fn(),
    set_drift_speed: vi.fn(),
    set_breathing_amount: vi.fn(),
    set_breathing_speed: vi.fn(),
    wait_for_textures: vi.fn(async () => undefined)
  }
  const viewer = {
    start_enter: vi.fn(),
    start_leave: vi.fn((_zoom, done) => done?.()),
    destroy: vi.fn()
  }
  return { mock_viewer: viewer, mock_scene: scene }
})

vi.mock('@/3d/engine/shared-renderer.js', () => ({
  register_viewer: vi.fn(() => mock_viewer)
}))

vi.mock('@/3d/scenes/create-poster-scene.js', () => ({
  create_poster_scene: vi.fn(() => mock_scene)
}))

vi.mock('@/utils/export-poster', () => ({
  prepare_poster_svg_for_3d: vi.fn(async svg => `<svg>${svg.outerHTML}</svg>`)
}))

vi.mock('@/3d/scenes/live-poster-scene.js', () => ({
  register_live_poster_scene: vi.fn(() => vi.fn())
}))

vi.mock('@/utils/preference', () => ({
  animate: { value: true },
  mosaic: { value: true },
  shadow: { value: true },
  stroke: { value: true },
  bold: { value: true },
  medium: { value: true },
  regular: { value: true },
  light: { value: true },
  background: { value: true },
  boulders: { value: true },
  rocks: { value: true },
  gravel: { value: true },
  sand: { value: true },
  sediment: { value: true },
  mosaic_spread: { value: 0.1 },
  mosaic_opacity: { value: 0.5 },
  shadow_spread: { value: 0.1 },
  shadow_opacity: { value: 0.5 },
  group_gap: { value: 0 },
  tilt_amount: { value: 1 },
  gyro_amount: { value: 1 },
  haze_enabled: { value: false },
  haze_color: { value: '#000' },
  haze_density: { value: 0 },
  drift_amount: { value: 0 },
  drift_speed: { value: 0 },
  breathing_amount: { value: 0 },
  breathing_speed: { value: 0 }
}))

describe('@/components/posters/as-viewer-3d.vue', () => {
  const itemid = '/+14151234356/posters/1737178477987'

  beforeEach(() => {
    vi.clearAllMocks()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.id = as_query_id(itemid)
    document.body.appendChild(svg)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers viewer when poster svg exists', async () => {
    const on_svg_zoom = vi.fn()
    shallowMount(as_viewer_3d, {
      props: { itemid, on_svg_zoom }
    })
    await flushPromises()

    const { register_viewer } = await import('@/3d/engine/shared-renderer.js')
    const { create_poster_scene } =
      await import('@/3d/scenes/create-poster-scene.js')

    expect(create_poster_scene).toHaveBeenCalled()
    expect(mock_scene.wait_for_textures).toHaveBeenCalled()
    expect(register_viewer).toHaveBeenCalled()
    expect(mock_viewer.start_enter).toHaveBeenCalledWith(on_svg_zoom)
    expect(
      mock_scene.wait_for_textures.mock.invocationCallOrder[0]
    ).toBeLessThan(mock_viewer.start_enter.mock.invocationCallOrder[0])
  })

  it('does nothing when poster svg is missing', async () => {
    document.body.innerHTML = ''
    shallowMount(as_viewer_3d, { props: { itemid } })
    await flushPromises()

    const { register_viewer } = await import('@/3d/engine/shared-renderer.js')
    expect(register_viewer).not.toHaveBeenCalled()
  })

  it('destroys viewer on unmount', async () => {
    const wrapper = shallowMount(as_viewer_3d, { props: { itemid } })
    await flushPromises()
    wrapper.unmount()

    expect(mock_viewer.destroy).toHaveBeenCalled()
  })

  it('syncs preferences when scene is ready', async () => {
    shallowMount(as_viewer_3d, { props: { itemid } })
    await flushPromises()

    expect(mock_scene.set_mosaic_visible).toHaveBeenCalledWith(true)
    expect(mock_scene.set_motion_enabled).toHaveBeenCalledWith(true)
  })
})
