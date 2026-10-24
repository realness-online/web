import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import DownloadVector from '@/components/download-vector.vue'

const { mock_extract, mock_render_canvas, mock_render_psd, mock_prepare_3d } =
  vi.hoisted(() => ({
    mock_extract: vi.fn(() => Promise.resolve([])),
    mock_render_canvas: vi.fn(() =>
      Promise.resolve({ convertToBlob: () => Promise.resolve(new Blob(['p'])) })
    ),
    mock_render_psd: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    mock_prepare_3d: vi.fn(() => Promise.resolve('<svg></svg>'))
  }))

vi.mock('@/utils/svg-to-psd', () => ({
  extract_all_layers: (...args) => mock_extract(...args),
  render_svg_layers_to_psd: (...args) => mock_render_psd(...args)
}))

vi.mock('@/utils/poster-canvas', () => ({
  render_complete_poster_to_canvas: (...args) => mock_render_canvas(...args)
}))

vi.mock('@/utils/export-poster', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    get_filename_for_poster: vi.fn(() => Promise.resolve('Poster.svg')),
    build_download_svg: vi.fn(svg => svg),
    prepare_poster_svg_for_3d: (...args) => mock_prepare_3d(...args)
  }
})

const { mock_export_audio, mock_export_glb, mock_wait_textures } = vi.hoisted(
  () => ({
    mock_export_audio: vi.fn(() => Promise.resolve()),
    mock_export_glb: vi.fn(),
    mock_wait_textures: vi.fn(() => Promise.resolve())
  })
)

vi.mock('@/utils/export-poster-video', () => ({
  export_poster_to_video_with_audio: (...args) => mock_export_audio(...args)
}))

const { mock_live_scene, mock_with_scene } = vi.hoisted(() => ({
  mock_live_scene: { value: null },
  mock_with_scene: vi.fn()
}))

vi.mock('@/3d/scenes/live-poster-scene.js', () => ({
  get_live_poster_scene: () => mock_live_scene.value
}))

vi.mock('@/3d/scenes/with-poster-scene.js', () => ({
  with_poster_scene: (...args) => mock_with_scene(...args)
}))

vi.mock('@/use/poster', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, is_vector_id: () => true }
})

const itemid = '/+14151234356/posters/1770000000000'

/** Every download path starts by finding the live poster SVG by query id. */
const mount_with_svg = () => {
  const set_working = vi.fn()
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  Object.defineProperty(svg, 'viewBox', {
    value: { baseVal: { width: 100, height: 50 } }
  })
  document.body.appendChild(svg)
  vi.spyOn(document, 'getElementById').mockReturnValue(svg)

  const wrapper = shallowMount(DownloadVector, {
    props: { itemid },
    global: { provide: { set_working } }
  })
  wrapper.vm.file_name = 'Poster.svg'
  return { wrapper, set_working, svg }
}

/** jsdom and happy-dom do not implement navigation, so a.click() is inert. */
const click_spy = () => {
  const clicks = []
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    const element = create(tag)
    if (tag === 'a')
      element.click = () => {
        clicks.push({
          href: element.getAttribute('href'),
          download: element.getAttribute('download')
        })
      }
    return element
  })
  return clicks
}

describe('@/components/download-vector.vue download paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    global.URL.createObjectURL = vi.fn(() => 'blob:download')
    global.URL.revokeObjectURL = vi.fn()
    global.OffscreenCanvas = class {
      getContext() {
        return { putImageData: vi.fn() }
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['png']))
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mock_live_scene.value = null
  })

  it('downloads the poster as SVG under the prepared file name', async () => {
    const { wrapper } = mount_with_svg()
    const clicks = click_spy()
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

    wrapper.vm.on_download_svg(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(clicks[0].download).toBe('Poster.svg')
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('does nothing for an SVG download without a poster element', () => {
    const { wrapper } = mount_with_svg()
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    const clicks = click_spy()

    wrapper.vm.on_download_svg({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(clicks).toHaveLength(0)
  })

  it('writes one PNG per extracted layer', async () => {
    mock_extract.mockResolvedValueOnce([
      { name: 'Regular', imageData: { data: new Uint8ClampedArray(4) } },
      { name: 'Mosaic Top', imageData: { data: new Uint8ClampedArray(4) } }
    ])
    const { wrapper, set_working } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_png_layers({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(clicks.map(click => click.download)).toEqual([
      'Poster_regular.png',
      'Poster_mosaic_top.png'
    ])
    expect(set_working).toHaveBeenLastCalledWith(false)
    expect(mock_extract).toHaveBeenCalledWith(expect.anything(), itemid, 3840)
  })

  it('downloads one flattened PNG at the poster aspect ratio', async () => {
    const { wrapper } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_download_png({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(clicks[0].download).toBe('Poster.png')
    expect(mock_render_canvas).toHaveBeenCalledWith(
      expect.anything(),
      3840,
      1920
    )
  })

  it('names a layer file without the svg suffix', async () => {
    mock_extract.mockResolvedValueOnce([
      { name: 'Bold Stroke', imageData: { data: new Uint8ClampedArray(4) } }
    ])
    const { wrapper } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_png_layers({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(clicks[0].download).toBe('Poster_bold_stroke.png')
  })

  it('reports a failed PSD export instead of downloading', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mock_render_psd.mockRejectedValueOnce(new Error('no layers'))
    const { wrapper, set_working } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(error).toHaveBeenCalledWith(
      '[PSD Download] PSD generation failed:',
      expect.any(Error)
    )
    expect(clicks).toHaveLength(0)
    expect(set_working).toHaveBeenLastCalledWith(false)
  })

  it('downloads the PSD it built, named from the poster', async () => {
    const { wrapper } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(mock_render_psd).toHaveBeenCalledWith(
      expect.anything(),
      itemid,
      undefined
    )
    expect(clicks[0].download).toBe('Poster.svg')
  })

  it('warns and stops when the PSD download finds no poster', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = mount_with_svg()
    vi.spyOn(document, 'getElementById').mockReturnValue(null)

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(error).toHaveBeenCalledWith(
      '[PSD Download] SVG element not found',
      expect.objectContaining({ query_id: expect.any(String) })
    )
    expect(mock_render_psd).not.toHaveBeenCalled()
  })

  it('opens the PSD in a tab on iOS Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'
    )
    const open = vi.spyOn(window, 'open').mockReturnValue({})
    const { wrapper } = mount_with_svg()

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(open).toHaveBeenCalledWith('blob:download', '_blank')
  })

  it('offers a tap target when iOS Safari blocks the new tab', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari/604.1'
    )
    vi.spyOn(window, 'open').mockReturnValue(null)
    const { wrapper } = mount_with_svg()
    const clicks = click_spy()

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(document.getElementById('ios-psd-download-link')).not.toBeNull()
    expect(clicks[0].download).toBe('Poster.svg')
  })

  it('reports a blocked tab when window.open throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'
    )
    vi.spyOn(window, 'open').mockImplementation(() => {
      throw new Error('popup blocked')
    })
    const { wrapper } = mount_with_svg()
    click_spy()

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(error).toHaveBeenCalledWith(
      '[PSD Download] window.open failed:',
      expect.any(Error)
    )
  })

  it('reports a failed standard download click', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { wrapper } = mount_with_svg()
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const element = create(tag)
      if (tag === 'a')
        element.click = () => {
          throw new Error('no gesture')
        }
      return element
    })

    await wrapper.vm.on_download_psd({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(error).toHaveBeenCalledWith(
      '[PSD Download] Standard download failed:',
      expect.any(Error)
    )
  })

  it('exports the live scene when the poster is already open in 3D', async () => {
    const live = {
      wait_for_textures: mock_wait_textures,
      export_glb: mock_export_glb
    }
    mock_live_scene.value = live
    const { wrapper, set_working } = mount_with_svg()

    await wrapper.vm.on_download_glb({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(mock_wait_textures).toHaveBeenCalled()
    expect(mock_export_glb).toHaveBeenCalledWith('Poster')
    expect(mock_prepare_3d).not.toHaveBeenCalled()
    expect(set_working).toHaveBeenLastCalledWith(false)
  })

  it('builds a scene from the poster svg when none is open', async () => {
    mock_with_scene.mockImplementation(async (_svg, run) => {
      await run({
        wait_for_textures: mock_wait_textures,
        export_glb: mock_export_glb
      })
    })
    const { wrapper } = mount_with_svg()

    await wrapper.vm.on_download_glb({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(mock_prepare_3d).toHaveBeenCalledWith(expect.anything(), itemid)
    expect(mock_export_glb).toHaveBeenCalledWith('Poster')
  })

  it('stops an export while a video is already rendering', () => {
    const { wrapper } = mount_with_svg()
    wrapper.vm.video_exporting = true

    wrapper.vm.on_toggle_menu({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(wrapper.vm.menu_open).toBe(false)
  })

  it('toggles the menu once the export is done', () => {
    const { wrapper } = mount_with_svg()

    wrapper.vm.on_toggle_menu({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    })

    expect(wrapper.vm.menu_open).toBe(true)
  })

  it('closes the menu on a click outside it', () => {
    const { wrapper } = mount_with_svg()
    wrapper.vm.menu_open = true
    wrapper.vm.menu_ref = { contains: () => false }
    wrapper.vm.button_ref = { contains: () => false }

    wrapper.vm.handle_click_outside({ target: document.body })

    expect(wrapper.vm.menu_open).toBe(false)
  })

  it('leaves the menu alone for a click inside it', () => {
    const { wrapper } = mount_with_svg()
    wrapper.vm.menu_open = true
    wrapper.vm.menu_ref = { contains: () => true }
    wrapper.vm.button_ref = { contains: () => false }

    wrapper.vm.handle_click_outside({ target: document.body })

    expect(wrapper.vm.menu_open).toBe(true)
  })

  it('ignores a click outside while a video is rendering', () => {
    const { wrapper } = mount_with_svg()
    wrapper.vm.menu_open = true
    wrapper.vm.video_exporting = true
    wrapper.vm.menu_ref = { contains: () => false }
    wrapper.vm.button_ref = { contains: () => false }

    wrapper.vm.handle_click_outside({ target: document.body })

    expect(wrapper.vm.menu_open).toBe(true)
  })

  it('reports frame progress and clears it when the export ends', async () => {
    mock_export_audio.mockImplementationOnce(async (_id, options) => {
      options.on_progress(3, 10)
      expect(mock_export_audio).toHaveBeenCalled()
    })
    const { wrapper, set_working } = mount_with_svg()

    await wrapper.vm.export_video()

    expect(wrapper.vm.video_progress).toBe(0)
    expect(wrapper.vm.video_total).toBe(0)
    expect(wrapper.vm.video_exporting).toBe(false)
    expect(set_working).toHaveBeenLastCalledWith(false)
  })

  it('clears export state even when the video export throws', async () => {
    mock_export_audio.mockRejectedValueOnce(new Error('encoder gone'))
    const { wrapper, set_working } = mount_with_svg()

    await expect(wrapper.vm.export_video()).rejects.toThrow('encoder gone')

    expect(wrapper.vm.video_exporting).toBe(false)
    expect(set_working).toHaveBeenLastCalledWith(false)
  })
})
