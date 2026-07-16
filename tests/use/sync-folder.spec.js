import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { get, set } from 'idb-keyval'

const { mock_build_local_directory, mock_build_download_svg, mock_filename } =
  vi.hoisted(() => ({
    mock_build_local_directory: vi.fn(),
    mock_build_download_svg: vi.fn(el => el),
    mock_filename: vi.fn(() => Promise.resolve('poster.svg'))
  }))

vi.mock('@/persistence/Directory', () => ({
  build_local_directory: mock_build_local_directory
}))

vi.mock('@/utils/export-poster', () => ({
  build_download_svg: mock_build_download_svg,
  get_filename_for_poster: mock_filename
}))

vi.mock('@/utils/itemid', () => ({
  as_query_id: vi.fn(() => 'poster_svg_id')
}))

vi.mock('@/components/posters/as-figure', () => ({
  default: {
    name: 'PosterAsFigure',
    props: ['itemid', 'menu'],
    template: '<div class="poster-stub" />'
  }
}))

import { sync_folder_supported, use } from '@/use/sync-folder'

function with_setup(composable, { provide = {} } = {}) {
  let result
  mount(
    defineComponent({
      setup() {
        result = composable()
        return () => {}
      }
    }),
    { global: { provide } }
  )
  return result
}

describe('@/use/sync-folder', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let set_working
  /** @type {ReturnType<typeof vi.fn>} */
  let show_directory_picker
  /** @type {SVGSVGElement | null} */
  let svg_el

  beforeEach(() => {
    vi.clearAllMocks()
    set_working = vi.fn()
    localStorage.me = '/+14151234356'
    get.mockResolvedValue(null)
    set.mockResolvedValue(undefined)

    const writable = {
      write: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve())
    }
    show_directory_picker = vi.fn(() =>
      Promise.resolve({
        name: 'Exports',
        getFileHandle: vi.fn(() =>
          Promise.resolve({
            createWritable: vi.fn(() => Promise.resolve(writable))
          })
        )
      })
    )
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: show_directory_picker,
      configurable: true,
      writable: true
    })
    Object.defineProperty(window, 'FileSystemFileHandle', {
      value: class FileSystemFileHandle {},
      configurable: true,
      writable: true
    })

    svg_el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg_el.id = 'poster_svg_id'
    document.body.appendChild(svg_el)

    mock_build_local_directory.mockResolvedValue({ items: [1000] })
  })

  afterEach(() => {
    svg_el?.remove()
    svg_el = null
  })

  it('sync_folder_supported is false when File System Access API is missing', () => {
    delete (/** @type {any} */ (window).showDirectoryPicker)
    delete (/** @type {any} */ (window).FileSystemFileHandle)
    expect(sync_folder_supported()).toBe(false)
  })

  it('sync_folder_supported is true when picker APIs exist', () => {
    expect(sync_folder_supported()).toBe(true)
  })

  it('loads saved folder name on mount', async () => {
    get.mockResolvedValueOnce({ name: 'Saved Folder' })
    const { sync_folder_name } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()
    expect(sync_folder_name.value).toBe('Saved Folder')
  })

  it('returns early from sync_folder when me is missing', async () => {
    delete localStorage.me
    const { sync_folder } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_folder()

    expect(show_directory_picker).toHaveBeenCalled()
    expect(mock_build_local_directory).not.toHaveBeenCalled()
    expect(set_working).not.toHaveBeenCalled()
  })

  it('returns early when there are no local posters', async () => {
    mock_build_local_directory.mockResolvedValueOnce({ items: [] })
    const { sync_folder } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_folder()

    expect(mock_build_local_directory).toHaveBeenCalled()
    expect(set_working).not.toHaveBeenCalled()
  })

  it('exports poster svg into the picked directory', async () => {
    const { sync_folder, sync_folder_name } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_folder()
    await flushPromises()

    expect(sync_folder_name.value).toBe('Exports')
    expect(set).toHaveBeenCalledWith(
      'sync_folder_handle',
      expect.objectContaining({ name: 'Exports' })
    )
    expect(set_working).toHaveBeenCalledWith(true)
    expect(set_working).toHaveBeenCalledWith(false)
    expect(mock_build_download_svg).toHaveBeenCalled()
    expect(mock_filename).toHaveBeenCalledWith(
      '/+14151234356/posters/1000',
      'svg'
    )
  })
})
