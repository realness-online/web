import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { get, set, keys } from 'idb-keyval'

const {
  mock_as_directory,
  mock_build_local_directory,
  mock_build_download_svg,
  mock_export_ready,
  mock_list,
  mock_load,
  mock_thoughts_for_author,
  mock_folder_name,
  mock_sync_svg,
  mock_sync_folder_pref,
  mock_figure_props,
  mock_figure_show,
  mock_figure_missing
} = vi.hoisted(() => ({
  mock_as_directory: vi.fn(),
  mock_build_local_directory: vi.fn(),
  mock_build_download_svg: vi.fn(el => el),
  mock_export_ready: vi.fn(() => Promise.resolve()),
  mock_list: vi.fn(() => Promise.resolve([])),
  mock_load: vi.fn(() => Promise.resolve(null)),
  mock_thoughts_for_author: vi.fn(() => []),
  mock_folder_name: vi.fn(() => '2026-07-18 morning — hello'),
  mock_sync_svg: { value: true },
  mock_sync_folder_pref: { value: true },
  mock_figure_props: [],
  mock_figure_show: { value: true },
  mock_figure_missing: { value: false }
}))

vi.mock('@/persistence/Directory', () => ({
  as_directory: mock_as_directory,
  build_local_directory: mock_build_local_directory,
  load_directory_from_network: vi.fn(() => Promise.resolve(null))
}))

vi.mock('@/utils/export-poster', () => ({
  build_download_svg: mock_build_download_svg,
  revalidate_poster_files: vi.fn(() => Promise.resolve()),
  wait_for_poster_export_ready: mock_export_ready
}))

vi.mock('@/utils/itemid', () => ({
  as_query_id: vi.fn(() => 'poster_svg_id'),
  as_created_at: vi.fn(id => {
    const parts = String(id).split('/')
    return Number(parts[parts.length - 1]) || null
  }),
  as_author: vi.fn(() => '/+14151234356'),
  list: mock_list,
  load: mock_load,
  load_from_network: vi.fn(() => Promise.resolve(null)),
  type_as_list: vi.fn(() => [])
}))

vi.mock('@/utils/thoughts', () => ({
  thoughts_for_author: mock_thoughts_for_author
}))

vi.mock('@/utils/folder-sync-paths', () => ({
  thought_folder_name: mock_folder_name,
  poster_file_name: vi.fn(() => '2026-07-18 morning 0930.svg')
}))

vi.mock('@/utils/preference', () => ({
  sync_svg: mock_sync_svg,
  sync_folder: mock_sync_folder_pref
}))

vi.mock('@/components/posters/as-figure', () => ({
  default: {
    name: 'PosterAsFigure',
    props: ['itemid', 'menu', 'pin'],
    emits: ['show', 'missing', 'remove', 'vector-click'],
    mounted() {
      mock_figure_props.push({ ...this.$props })
      if (mock_figure_missing.value) this.$emit('missing', this.itemid)
      else if (mock_figure_show.value) this.$emit('show', { id: this.itemid })
    },
    template: '<div class="poster-stub" />'
  }
}))

import {
  sync_folder_supported,
  use,
  enqueue_folder_sync,
  drain_folder_queue,
  clear_failed_thoughts
} from '@/use/sync-folder'

const me = '/+14151234356'
const poster_id = `${me}/posters/1000`

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
  /** @type {ReturnType<typeof vi.fn>} */
  let get_directory_handle
  /** @type {ReturnType<typeof vi.fn>} */
  let get_file_handle
  /** @type {ReturnType<typeof vi.fn>} */
  let write
  /** @type {ReturnType<typeof vi.fn>} */
  let remove_entry
  /** @type {SVGSVGElement | null} */
  let svg_el
  /** @type {object} */
  let folder_handle

  beforeEach(() => {
    vi.clearAllMocks()
    clear_failed_thoughts()
    mock_sync_svg.value = true
    mock_sync_folder_pref.value = true
    mock_figure_props.length = 0
    mock_figure_show.value = true
    mock_figure_missing.value = false
    set_working = vi.fn()
    localStorage.me = me
    get.mockImplementation(async key => {
      if (key === 'sync_folder_handle') return folder_handle
      if (key === 'sync:folder-queue') return []
      if (key === 'sync:folder-manifest') return { thoughts: {} }
      return null
    })
    set.mockResolvedValue(undefined)
    keys.mockResolvedValue([])
    mock_list.mockResolvedValue([])
    mock_load.mockResolvedValue({ id: poster_id })
    mock_folder_name.mockReturnValue('2026-07-18 morning — hello')

    write = vi.fn(() => Promise.resolve())
    remove_entry = vi.fn(() => Promise.resolve())
    const writable = { write, close: vi.fn(() => Promise.resolve()) }
    // Like the real API: probing a file that was never created rejects
    get_file_handle = vi.fn((name, opts) =>
      opts?.create
        ? Promise.resolve({
            createWritable: vi.fn(() => Promise.resolve(writable))
          })
        : Promise.reject(new Error('NotFoundError'))
    )
    get_directory_handle = vi.fn(() =>
      Promise.resolve({ getFileHandle: get_file_handle })
    )
    folder_handle = {
      name: 'Exports',
      getDirectoryHandle: get_directory_handle,
      removeEntry: remove_entry,
      queryPermission: vi.fn(() => Promise.resolve('granted')),
      requestPermission: vi.fn(() => Promise.resolve('granted'))
    }
    show_directory_picker = vi.fn(() => Promise.resolve(folder_handle))
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
    svg_el.innerHTML = '<use href="#regular"></use><path d="M0 0"></path>'
    const figure = document.createElement('figure')
    const poster_root = document.createElement('svg')
    poster_root.setAttribute('itemtype', '/posters')
    const defs_svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    )
    defs_svg.setAttribute('data-poster-symbol-defs', '')
    defs_svg.innerHTML = '<symbol id="regular"><path d="M0 0"/></symbol>'
    figure.appendChild(poster_root)
    figure.appendChild(svg_el)
    figure.appendChild(defs_svg)
    document.body.appendChild(figure)

    mock_as_directory.mockResolvedValue({ items: [1000], archive: [] })
    mock_build_local_directory.mockResolvedValue({ items: [1000], archive: [] })
    mock_thoughts_for_author.mockReturnValue([
      {
        author_id: me,
        started_at: 1000,
        posters: [{ id: poster_id, type: 'posters' }],
        statements: []
      }
    ])
  })

  afterEach(() => {
    svg_el?.closest('figure')?.remove()
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
    const { sync_folder_name } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()
    expect(sync_folder_name.value).toBe('Exports')
  })

  it('choose_folder stores the handle without requiring me', async () => {
    delete localStorage.me
    const { choose_folder } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()
    await choose_folder()
    expect(show_directory_picker).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith('sync_folder_handle', folder_handle)
  })

  it('sync_now exports poster svg into a named thought folder', async () => {
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(get_directory_handle).toHaveBeenCalledWith(
      '2026-07-18 morning — hello',
      { create: true }
    )
    expect(get_file_handle).toHaveBeenCalledWith(
      '2026-07-18 morning 0930.svg',
      { create: true }
    )
    expect(set_working).toHaveBeenCalledWith(true)
    expect(set_working).toHaveBeenCalledWith(false)
    expect(mock_build_download_svg).toHaveBeenCalled()
  })

  it('writes notes.md for statements', async () => {
    mock_thoughts_for_author.mockReturnValueOnce([
      {
        author_id: me,
        started_at: 1000,
        posters: [],
        statements: [
          { id: `${me}/statements/1001`, statement: 'first' },
          { id: `${me}/statements/1002`, statement: 'second' }
        ]
      }
    ])
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    expect(get_file_handle).toHaveBeenCalledWith('notes.md', { create: true })
    const blob = write.mock.calls[0][0]
    expect(await blob.text()).toContain('first')
    expect(await blob.text()).toContain('second')
  })

  it('groups posters and statements into thoughts', async () => {
    const statement = { id: `${me}/statements/1001`, statement: 'hi' }
    mock_list.mockResolvedValueOnce([statement])
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    expect(mock_list).toHaveBeenCalledWith(`${me}/statements`)
    expect(mock_thoughts_for_author).toHaveBeenCalledWith([
      { id: poster_id, type: 'posters' },
      statement
    ])
  })

  it('mounts the poster pinned so cutouts load off-screen', async () => {
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_figure_props[0]).toMatchObject({ pin: true, menu: false })
  })

  it('skips posters when sync_svg is off but still writes notes', async () => {
    mock_sync_svg.value = false
    mock_thoughts_for_author.mockReturnValueOnce([
      {
        author_id: me,
        started_at: 1000,
        posters: [{ id: poster_id, type: 'posters' }],
        statements: [{ id: `${me}/statements/1001`, statement: 'hi' }]
      }
    ])
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    expect(get_file_handle).toHaveBeenCalledWith('notes.md', { create: true })
    expect(mock_build_download_svg).not.toHaveBeenCalled()
  })

  it('skips posters that cannot be confirmed instead of waiting to timeout', async () => {
    mock_load.mockResolvedValue(null)
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
    expect(mock_figure_props.length).toBe(0)
  })

  it('skips rewrite when manifest matches and files exist on disk', async () => {
    const path = '2026-07-18 morning — hello'
    const key = `1000|svg:true|${poster_id}|`
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { thoughts: { 1000: { path, key } } }
      return null
    })
    // Files exist on disk, so bare probes resolve
    get_file_handle.mockImplementation(() =>
      Promise.resolve({ createWritable: vi.fn() })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('resyncs a manifest entry whose folder is missing on disk', async () => {
    const path = '2026-07-18 morning — hello'
    const key = `1000|svg:true|${poster_id}|`
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { thoughts: { 1000: { path, key } } }
      return null
    })
    // Disk probe fails: the folder was emptied or switched since the last run
    get_directory_handle.mockRejectedValueOnce(new Error('NotFoundError'))
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(get_file_handle).toHaveBeenCalledWith(
      '2026-07-18 morning 0930.svg',
      { create: true }
    )
    expect(mock_build_download_svg).toHaveBeenCalled()
  })

  it('enqueue drains into a reconcile when the pref is on', async () => {
    vi.useFakeTimers()
    await enqueue_folder_sync(/** @type {any} */ (poster_id), 'save')
    expect(set).toHaveBeenCalledWith(
      'sync:folder-queue',
      expect.arrayContaining([
        expect.objectContaining({ id: poster_id, action: 'save' })
      ])
    )
    const drain = drain_folder_queue({ set_working, force: true })
    await vi.runAllTimersAsync()
    await drain
    await flushPromises()
    expect(get_directory_handle).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('cancels an in-flight sync and removes folders created this run', async () => {
    // Figure never emits show — the sync stays pending on the mount promise
    mock_figure_show.value = false
    const { sync_now, cancel_folder_sync, folder_sync_status } = with_setup(
      () => use(),
      { provide: { set_working } }
    )
    await flushPromises()

    const pending = sync_now()
    await flushPromises()
    expect(folder_sync_status.value).toBe('syncing')

    cancel_folder_sync()
    mock_sync_folder_pref.value = false
    await pending
    await flushPromises()

    expect(remove_entry).toHaveBeenCalledWith('2026-07-18 morning — hello', {
      recursive: true
    })
    expect(folder_sync_status.value).toBe('idle')
  })

  it('skips the poster when the figure emits missing', async () => {
    mock_figure_missing.value = true
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })

  it('does not retry a failed thought until the next user-triggered sync', async () => {
    mock_export_ready.mockRejectedValue(new Error('symbols never loaded'))
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()
    expect(mock_figure_props.length).toBe(1)
    expect(write).not.toHaveBeenCalled()

    // Automatic drains (queue, visibility) skip the failed thought
    await drain_folder_queue({ force: true, set_working })
    await flushPromises()
    expect(mock_figure_props.length).toBe(1)

    // A user-triggered sync clears the skip list and retries
    mock_export_ready.mockResolvedValue(undefined)
    await sync_now()
    await flushPromises()
    expect(mock_figure_props.length).toBe(2)
    expect(write).toHaveBeenCalled()
  })
})
