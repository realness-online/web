import { vi } from 'vite-plus/test'
import {
  get_live_poster_scene,
  register_live_poster_scene
} from '@/3d/scenes/live-poster-scene.js'

describe('live_poster_scene', () => {
  const itemid = '/+1/posters/1'

  it('registers and unregisters a scene by itemid', () => {
    const scene = { export_glb: vi.fn() }
    const unregister = register_live_poster_scene(itemid, scene)

    expect(get_live_poster_scene(itemid)).toBe(scene)

    unregister()
    expect(get_live_poster_scene(itemid)).toBeUndefined()
  })
})
