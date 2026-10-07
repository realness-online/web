import { vi } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import DownloadVector from '@/components/download-vector.vue'

vi.mock('@/utils/svg-to-psd', () => ({
  render_svg_layers_to_psd: vi.fn(),
  extract_all_layers: vi.fn(async () => {
    throw new Error('extract failed')
  })
}))

vi.mock('@/utils/poster-canvas', () => ({
  render_complete_poster_to_canvas: vi.fn(async () => {
    throw new Error('canvas failed')
  })
}))

vi.mock('@/utils/svg-to-video', () => ({
  render_svg_to_video_blob: vi.fn(async () => new Blob(['video'])),
  download_video: vi.fn(),
  level51_video_size: vi.fn(() => ({ width: 2160, height: 2160 }))
}))

vi.mock('@/utils/export-poster-video', () => ({
  export_poster_to_video_with_audio: vi.fn(async () => {})
}))

vi.mock('@/utils/export-poster', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    get_filename_for_poster: vi.fn(async () => 'poster.mov')
  }
})

const itemid = '/+14151234356/posters/1770000000000'

describe('@/components/download-vector.vue', () => {
  const mount_with_svg = () => {
    const set_working = vi.fn()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    Object.defineProperty(svg, 'viewBox', {
      value: { baseVal: { width: 100, height: 100 } }
    })
    svg.id = 'poster-1770000000000'
    document.body.appendChild(svg)
    vi.spyOn(document, 'getElementById').mockReturnValue(svg)

    const wrapper = shallowMount(DownloadVector, {
      props: { itemid },
      global: { provide: { set_working } }
    })
    return { wrapper, set_working, svg }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('png_layers resets working state when export throws', async () => {
    const { wrapper, set_working } = mount_with_svg()
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

    await expect(wrapper.vm.on_png_layers(event)).rejects.toThrow(
      'extract failed'
    )

    expect(set_working).toHaveBeenCalledWith(true)
    expect(set_working).toHaveBeenLastCalledWith(false)
  })

  it('download_png_handler resets working state when render throws', async () => {
    const { wrapper, set_working } = mount_with_svg()
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

    await expect(wrapper.vm.on_download_png(event)).rejects.toThrow(
      'canvas failed'
    )

    expect(set_working).toHaveBeenCalledWith(true)
    expect(set_working).toHaveBeenLastCalledWith(false)
  })

  it('exports video through the shared exporter with the poster itemid', async () => {
    const { export_poster_to_video_with_audio } =
      await import('@/utils/export-poster-video')
    const { wrapper, set_working } = mount_with_svg()
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

    await wrapper.vm.on_download_video(event)

    // Video rendering/looping lives in the shared exporter (and, beneath it,
    // svg-to-video.js's own tests); this just checks the wiring and that the
    // component's working state wraps the call.
    expect(export_poster_to_video_with_audio).toHaveBeenCalledWith(
      itemid,
      expect.objectContaining({ audio_buffers: undefined })
    )
    expect(set_working).toHaveBeenLastCalledWith(false)
  })
})
