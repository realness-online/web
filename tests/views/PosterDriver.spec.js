import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  vectorize: vi.fn(),
  mount_workers: vi.fn(),
  resize_to_blob: vi.fn(),
  render_complete_poster_to_canvas: vi.fn(),
  render_svg_layers_to_psd: vi.fn(),
  prepare_poster_svg_for_3d: vi.fn(),
  wait_for_poster_export_ready: vi.fn(),
  with_poster_scene: vi.fn(),
  del: vi.fn()
}))

vi.mock('idb-keyval', () => ({ del: mocks.del }))

// The poster components pull in the whole rendering tree - gradients, svg,
// workers. This view only ever mounts them off screen; the driver is what is
// under test.
vi.mock('@/components/posters/as-figure', () => ({
  default: { name: 'AsFigure', template: '<figure />' }
}))
vi.mock('@/components/posters/as-svg-processing', () => ({
  default: { name: 'AsSvgProcessing', template: '<div />' }
}))

vi.mock('@/use/vectorize', () => ({
  use: () => ({
    vectorize: mocks.vectorize,
    new_vector: ref(null),
    mount_workers: mocks.mount_workers
  }),
  resize_to_blob: mocks.resize_to_blob
}))

vi.mock('@/use/poster', () => ({ geology_layers: ['bass', 'tenor'] }))

vi.mock('@/use/vectorize/queue', () => ({
  completed_posters: ref([]),
  current_processing: ref(null)
}))

vi.mock('@/utils/itemid', () => ({
  as_query_id: vi.fn(id => `id${String(id).replace(/[/+]/g, '')}`),
  as_layer_id: vi.fn((id, layer) => `${id}/${layer}`)
}))

vi.mock('@/utils/algorithms', () => ({
  mutex_for: vi.fn(() => ({
    lock: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn()
  }))
}))

vi.mock('@/utils/export-poster', () => ({
  build_download_svg: vi.fn(svg => svg),
  prepare_poster_svg_for_3d: mocks.prepare_poster_svg_for_3d,
  wait_for_poster_export_ready: mocks.wait_for_poster_export_ready
}))

vi.mock('@/utils/poster-canvas', () => ({
  render_complete_poster_to_canvas: mocks.render_complete_poster_to_canvas
}))

vi.mock('@/utils/svg-to-psd', () => ({
  render_svg_layers_to_psd: mocks.render_svg_layers_to_psd
}))

vi.mock('@/3d/scenes/with-poster-scene.js', () => ({
  with_poster_scene: mocks.with_poster_scene
}))

import { completed_posters } from '@/use/vectorize/queue'
import PosterDriver from '@/views/PosterDriver.vue'
import poster_driver_prompt from '@/content/agent-prompt-poster-driver.md?raw'

const stubs = {
  'as-prompt-agent': {
    name: 'AsPromptAgent',
    props: ['prompt', 'heading', 'desc', 'button'],
    template: '<button>{{ button }}</button>'
  }
}

const render_driver = () => mount(PosterDriver, { global: { stubs } })

describe('@/views/PosterDriver', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    delete window.poster_driver
    vi.unstubAllGlobals()
  })

  it('publishes the render api a script drives it by', async () => {
    // scripts/render-poster-video.js opens this page and talks to exactly this
    // object over the devtools protocol. Renaming any of it breaks the video
    // pipeline silently, from a repo that cannot see this file.
    const wrapper = render_driver()
    await flushPromises()

    expect(typeof window.poster_driver.render).toBe('function')
    expect(window.poster_driver.ready).toBe(true)
    expect(window.poster_driver.get_status()).toBe('Ready')
    wrapper.unmount()
  })

  it('mounts the tracing workers so the first render does not have to wait', () => {
    const wrapper = render_driver()
    expect(mocks.mount_workers).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('is busy until the api is up', async () => {
    const wrapper = render_driver()
    const article = wrapper.find('article')
    await flushPromises()
    expect(article.attributes('aria-busy')).toBe('false')
    wrapper.unmount()
  })

  it('hands a visitor the driver prompt, not the instance one', async () => {
    const wrapper = render_driver()
    await flushPromises()

    const prompt = wrapper.findComponent({ name: 'AsPromptAgent' })
    expect(prompt.exists()).toBe(true)
    expect(prompt.props('prompt')).toBe(poster_driver_prompt)
    expect(prompt.props('button')).toBe('Copy driver prompt')
    wrapper.unmount()
  })

  it('shows the render call and the video command, copyable', async () => {
    const write_text = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: write_text }
    })

    const wrapper = render_driver()
    await flushPromises()

    const snippets = wrapper.findAll('pre')
    expect(snippets).toHaveLength(2)
    expect(snippets[0].text()).toContain('window.poster_driver.render')
    expect(snippets[1].text()).toContain('npm run poster:video')

    await snippets[0].find('button').trigger('click')
    await flushPromises()

    // The code, not the button label that lives inside the same `pre`.
    expect(write_text).toHaveBeenCalledWith(
      expect.stringContaining('window.poster_driver.render')
    )
    expect(write_text).not.toHaveBeenCalledWith(expect.stringContaining('Copy'))
    wrapper.unmount()
  })

  it('says Copied on the snippet you copied, and only that one', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
    const wrapper = render_driver()
    await flushPromises()

    const buttons = wrapper.findAll('pre button')
    await buttons[1].trigger('click')
    await flushPromises()

    expect(buttons[1].text()).toBe('Copied')
    expect(buttons[0].text()).toBe('Copy')
    wrapper.unmount()
  })

  describe('render', () => {
    /**
     * Stand in for the poster the feed would have mounted. The driver waits for a
     * real element whose viewBox matches what it resized to, so the test has to
     * put one there the moment tracing "finishes".
     * @param {string} itemid
     */
    const poster_arrives = itemid => {
      const figure = document.createElement('figure')
      figure.innerHTML = `<div itemtype="/posters"></div><svg id="id${itemid.replace(/[/+]/g, '')}" viewBox="0 0 800 600"></svg><svg data-poster-symbol-defs></svg>`
      document.body.appendChild(figure)
      return figure
    }

    /** Resolves with the itemid the driver minted, once it starts tracing. */
    const traced = () =>
      new Promise(resolve => {
        mocks.vectorize.mockImplementation(async (blob, itemid) => {
          completed_posters.value = [...completed_posters.value, itemid]
          resolve(itemid)
        })
      })

    beforeEach(() => {
      document.body.innerHTML = ''
      completed_posters.value = []
      mocks.resize_to_blob.mockResolvedValue({
        blob: new Blob(['image']),
        width: 800,
        height: 600
      })
      mocks.wait_for_poster_export_ready.mockResolvedValue(undefined)
      mocks.render_complete_poster_to_canvas.mockResolvedValue({
        convertToBlob: async () =>
          new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
      })
      mocks.render_svg_layers_to_psd.mockResolvedValue(new Uint8Array([4, 5]))
      mocks.prepare_poster_svg_for_3d.mockResolvedValue('<svg/>')
      mocks.with_poster_scene.mockImplementation(async (_svg, run) =>
        run({
          wait_for_textures: async () => {},
          parse_glb: async () => new Uint8Array([6, 7])
        })
      )
    })

    const drive = async formats => {
      const wrapper = render_driver()
      await flushPromises()
      const arriving = traced()
      const rendering = window.poster_driver.render(
        'data:image/png;base64,AQID',
        formats ? { formats } : undefined
      )
      poster_arrives(await arriving)
      const poster = await rendering
      wrapper.unmount()
      return poster
    }

    it('traces an image and hands back a poster', async () => {
      const poster = await drive()

      expect(poster.width).toBe(800)
      expect(poster.height).toBe(600)
      expect(poster.viewbox).toBe('0 0 800 600')
      expect(poster.png).toMatch(/^data:image\/png;base64,/)
      expect(poster.svg).toContain('<svg')
    })

    it('asks only for the formats it was asked for', async () => {
      // PSD and GLB cost real time per frame, and a movie is thousands of
      // frames. Defaulting to png only is the difference between an overnight
      // render and a week of them.
      const poster = await drive()

      expect(poster.psd).toBeNull()
      expect(poster.glb).toBeNull()
      expect(mocks.render_svg_layers_to_psd).not.toHaveBeenCalled()
      expect(mocks.with_poster_scene).not.toHaveBeenCalled()
    })

    it('builds psd and glb when they are asked for', async () => {
      const poster = await drive(['png', 'psd', 'glb'])

      expect(poster.psd).toBe(btoa(String.fromCharCode(4, 5)))
      expect(poster.glb).toBe(btoa(String.fromCharCode(6, 7)))
    })

    it('drops the poster and every layer so a long batch stays flat', async () => {
      // Thousands of frames through one browser. Anything left behind is a leak
      // that ends the render.
      const poster = await drive()

      expect(mocks.del).toHaveBeenCalledWith(poster.itemid)
      expect(mocks.del).toHaveBeenCalledWith(`${poster.itemid}/shadows`)
      expect(mocks.del).toHaveBeenCalledWith(`${poster.itemid}/bass`)
      expect(mocks.del).toHaveBeenCalledWith(`${poster.itemid}/tenor`)
    })

    it('reports each phase so a driving script can log progress', async () => {
      const wrapper = render_driver()
      await flushPromises()
      const arriving = traced()
      const rendering = window.poster_driver.render(
        'data:image/png;base64,AQID'
      )

      const itemid = await arriving
      expect(window.poster_driver.get_status()).toBe('Vectorizing')

      poster_arrives(itemid)
      await rendering
      expect(window.poster_driver.get_status()).toBe('Done')
      wrapper.unmount()
    })
  })

  it('keeps the render surface out of the page and out of the a11y tree', async () => {
    const wrapper = render_driver()
    await flushPromises()

    const surface = wrapper.find('aside')
    expect(surface.attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })
})
