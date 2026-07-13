import { vi } from 'vite-plus/test'
import { with_poster_scene } from '@/3d/scenes/with-poster-scene.js'

const mock_scene = {
  wait_for_textures: vi.fn(async () => []),
  export_glb: vi.fn(),
  dispose: vi.fn()
}

const mock_dispose = vi.fn()
const mock_app = {
  mount_scene: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  get_renderer: vi.fn(() => ({ dispose: mock_dispose }))
}

vi.mock('@/3d/engine/create-app.js', () => ({
  create_app: vi.fn(() => mock_app)
}))

vi.mock('@/3d/scenes/create-poster-scene.js', () => ({
  create_poster_scene: vi.fn(() => mock_scene)
}))

describe('with_poster_scene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts scene, runs callback, then disposes', async () => {
    await with_poster_scene('<svg></svg>', async scene => {
      await scene.wait_for_textures()
      scene.export_glb('test')
    })

    expect(mock_app.mount_scene).toHaveBeenCalledWith(mock_scene)
    expect(mock_app.start).toHaveBeenCalled()
    expect(mock_scene.export_glb).toHaveBeenCalledWith('test')
    expect(mock_app.stop).toHaveBeenCalled()
    expect(mock_dispose).toHaveBeenCalled()
  })
})
