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
  mock_list_history_page,
  mock_load,
  mock_thoughts_for_author,
  mock_folder_path,
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
  mock_list_history_page: vi.fn(() => Promise.resolve([])),
  mock_load: vi.fn(() => Promise.resolve(null)),
  mock_thoughts_for_author: vi.fn(() => []),
  mock_folder_path: vi.fn(() => '07-18 Saturday morning — hello'),
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
  list_history_page: mock_list_history_page,
  load: mock_load,
  load_from_network: vi.fn(() => Promise.resolve(null)),
  type_as_list: vi.fn(() => [])
}))

vi.mock('@/utils/thoughts', () => ({
  thoughts_for_author: mock_thoughts_for_author
}))

vi.mock('@/utils/folder-sync-paths', () => ({
  thought_folder_path: mock_folder_path,
  thought_file_name: vi.fn(() => '07-18 Saturday morning — hello.md'),
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

const with_setup = (composable, { provide = {} } = {}) => {
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

/** @type {ReturnType<typeof vi.spyOn>[]} */
const console_spies = []

/** @param {'warn' | 'error'} method */
const silence_console = method => {
  const spy = vi.spyOn(console, method).mockImplementation(() => {})
  console_spies.push(spy)
  return spy
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
    mock_folder_path.mockReturnValue('07-18 Saturday morning — hello')

    write = vi.fn(() => Promise.resolve())
    remove_entry = vi.fn(() => Promise.resolve())
    const writable = { write, close: vi.fn(() => Promise.resolve()) }
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
    console_spies.splice(0).forEach(spy => spy.mockRestore())
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
    const warn = silence_console('warn')
    delete localStorage.me
    const { choose_folder } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()
    await choose_folder()
    expect(show_directory_picker).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith('sync_folder_handle', folder_handle)
    expect(warn).toHaveBeenCalledWith(
      '[sync-folder] abort: localStorage.me missing'
    )
  })

  it('sync_now exports poster svg into a named thought folder', async () => {
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(get_directory_handle).toHaveBeenCalledWith(
      '07-18 Saturday morning — hello',
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

  it('writes one titled note for a thought, with one frontmatter block', async () => {
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

    expect(get_file_handle).toHaveBeenCalledWith(
      '07-18 Saturday morning — hello.md',
      { create: true }
    )
    const text = await write.mock.calls[0][0].text()
    expect(text.startsWith(`---\nitemid: ${me}/thoughts/1000\n`)).toBe(true)
    expect(text).toContain('created: 1970-01-01T00:00:01.000Z')
    expect(text).toContain(
      `statements:\n  - ${me}/statements/1001\n  - ${me}/statements/1002`
    )
    expect(text.match(/^---$/gm)).toHaveLength(2)
    expect(text).toContain('first')
    expect(text).toContain('second')
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

  it('walks archived statement pages, not just the index', async () => {
    const recent = { id: `${me}/statements/9000`, statement: 'today' }
    const archived = { id: `${me}/statements/500`, statement: 'years ago' }
    mock_list.mockResolvedValueOnce([recent])
    mock_as_directory.mockResolvedValue({ items: [1000, 'index'], archive: [] })
    mock_list_history_page.mockResolvedValue([recent, archived])
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    expect(mock_list_history_page).toHaveBeenCalledWith(`${me}/statements/1000`)
    const [gathered] = mock_thoughts_for_author.mock.calls.at(-1)
    expect(gathered).toContainEqual(archived)
    expect(gathered.filter(item => item.id === recent.id)).toHaveLength(1)
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

    expect(get_file_handle).toHaveBeenCalledWith(
      '07-18 Saturday morning — hello.md',
      { create: true }
    )
    expect(mock_build_download_svg).not.toHaveBeenCalled()
  })

  it('skips posters that cannot be confirmed instead of waiting to timeout', async () => {
    const warn = silence_console('warn')
    mock_load.mockResolvedValue(null)
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
    expect(mock_figure_props.length).toBe(0)
    expect(warn).toHaveBeenCalledWith(
      '[sync-folder] poster unavailable; skipping',
      poster_id
    )
  })

  it('skips rewrite when manifest matches and files exist on disk', async () => {
    const path = '07-18 Saturday morning — hello'
    const key = `v2|1000|svg:true|${poster_id}|`
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { version: 2, thoughts: { 1000: { path, key } } }
      return null
    })
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

  it('re-exports files written by an older format version', async () => {
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest') return { version: 1, thoughts: {} }
      return null
    })
    get_file_handle.mockImplementation(() =>
      Promise.resolve({
        createWritable: vi.fn(() =>
          Promise.resolve({ write, close: vi.fn(() => Promise.resolve()) })
        )
      })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).toHaveBeenCalled()
    const saved = set.mock.calls.find(
      ([k]) => k === 'sync:folder-manifest'
    )?.[1]
    expect(saved.version).toBe(2)
  })

  it('trusts files on disk when the format version matches', async () => {
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest') return { version: 2, thoughts: {} }
      return null
    })
    get_file_handle.mockImplementation(() =>
      Promise.resolve({
        createWritable: vi.fn(() =>
          Promise.resolve({ write, close: vi.fn(() => Promise.resolve()) })
        )
      })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
  })

  it('rewrites a thought whose folder moved, content unchanged', async () => {
    const key = `v2|1000|svg:true|${poster_id}|`
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return {
          thoughts: { 1000: { path: '2026-07-18 morning — hello', key } }
        }
      return null
    })
    get_file_handle.mockImplementation(() =>
      Promise.resolve({ createWritable: vi.fn() })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(remove_entry).toHaveBeenCalledWith('2026-07-18 morning — hello', {
      recursive: true
    })
    expect(get_directory_handle).toHaveBeenCalledWith(
      '07-18 Saturday morning — hello',
      { create: true }
    )
  })

  it('resyncs a manifest entry whose folder is missing on disk', async () => {
    const path = '07-18 Saturday morning — hello'
    const key = `1000|svg:true|${poster_id}|`
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { thoughts: { 1000: { path, key } } }
      return null
    })
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

    expect(remove_entry).toHaveBeenCalledWith(
      '07-18 Saturday morning — hello',
      {
        recursive: true
      }
    )
    expect(folder_sync_status.value).toBe('idle')
  })

  it('skips the poster when the figure emits missing', async () => {
    const error = silence_console('error')
    mock_figure_missing.value = true
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(mock_build_download_svg).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      '[sync-folder] skipped poster',
      poster_id,
      expect.any(Error)
    )
  })

  it('aborts with a warning when the folder preference is off', async () => {
    const warn = silence_console('warn')
    mock_sync_folder_pref.value = false

    const result = await drain_folder_queue({ force: true, set_working })

    expect(result).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('[sync-folder] drain skip: preference off')
  })

  it('asks for permission when no folder handle is stored', async () => {
    const warn = silence_console('warn')
    folder_handle = null
    const { folder_sync_status } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await drain_folder_queue({ force: true, set_working })

    expect(warn).toHaveBeenCalledWith('[sync-folder] drain skip: no folder handle')
    expect(folder_sync_status.value).toBe('needs_permission')
  })

  it('stops before writing when folder permission is denied', async () => {
    const warn = silence_console('warn')
    folder_handle.queryPermission = vi.fn(() => Promise.resolve('denied'))
    folder_handle.requestPermission = vi.fn(() => Promise.resolve('denied'))
    const { folder_sync_status, sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    expect(warn).toHaveBeenCalledWith(
      '[sync-folder] abort: folder permission denied'
    )
    expect(folder_sync_status.value).toBe('needs_permission')
    expect(write).not.toHaveBeenCalled()
  })

  it('regrants access when the folder only offers requestPermission', async () => {
    const handle = {
      name: 'Exports',
      getDirectoryHandle: get_directory_handle,
      removeEntry: remove_entry,
      requestPermission: vi.fn(() => Promise.resolve('granted'))
    }
    folder_handle = handle
    const { sync_now, folder_sync_status } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(handle.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite'
    })
    expect(folder_sync_status.value).toBe('idle')
  })

  it('reads a folder handle that carries neither permission method', async () => {
    folder_handle = {
      name: 'Exports',
      getDirectoryHandle: get_directory_handle,
      removeEntry: remove_entry
    }
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(get_file_handle).toHaveBeenCalled()
  })

  it('names the archive when a full sync fails', async () => {
    const error = silence_console('error')
    mock_as_directory.mockRejectedValue(new Error('storage offline'))
    mock_build_local_directory.mockRejectedValue(new Error('storage offline'))
    const { sync_now, folder_sync_status, folder_sync_error } = with_setup(
      () => use(),
      { provide: { set_working } }
    )
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(folder_sync_status.value).toBe('error')
    expect(folder_sync_error.value).toBe('storage offline')
    expect(error).toHaveBeenCalledWith(
      '[sync-folder] run failed',
      expect.any(Error)
    )
  })

  it('falls back to legacy thoughts when no statements are stored', async () => {
    mock_list.mockImplementation(async id =>
      String(id).endsWith('/thoughts')
        ? [
            {
              id: `${me}/thoughts/1000`,
              thought: 'from the old feed'
            }
          ]
        : []
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    const [gathered] = mock_thoughts_for_author.mock.calls.at(-1)
    expect(gathered).toContainEqual(
      expect.objectContaining({
        id: `${me}/statements/1000`,
        statement: 'from the old feed'
      })
    )
  })

  it('collects statements left behind in local storage alone', async () => {
    const stray_id = `${me}/statements/4242`
    Object.defineProperty(localStorage, 'length', {
      value: 1,
      configurable: true
    })
    Object.defineProperty(localStorage, 'key', {
      value: () => stray_id,
      configurable: true
    })
    mock_list.mockResolvedValue([])
    mock_load.mockResolvedValue({
      id: stray_id,
      statement: 'stranded',
      type: 'statements'
    })
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()

    const [gathered] = mock_thoughts_for_author.mock.calls.at(-1)
    expect(gathered).toContainEqual(
      expect.objectContaining({ id: stray_id, statement: 'stranded' })
    )
    delete localStorage.length
    delete localStorage.key
  })

  it('drops a thought whose archived page cannot be read', async () => {
    const warn = silence_console('warn')
    mock_as_directory.mockResolvedValue({ items: [1000, 900], archive: [] })
    mock_list_history_page.mockRejectedValueOnce(new Error('page gone'))
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(warn).toHaveBeenCalledWith(
      '[sync-folder] statement page failed',
      1000,
      expect.any(Error)
    )
  })

  it('deletes the folder of a thought that lost every statement and poster', async () => {
    const path = '07-18 Saturday morning — hello'
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { thoughts: { 1000: { path, key: 'stale' } } }
      return null
    })
    mock_thoughts_for_author.mockReturnValueOnce([
      { author_id: me, started_at: 1000, posters: [], statements: [] }
    ])
    get_file_handle.mockImplementation(() =>
      Promise.resolve({ createWritable: vi.fn() })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(remove_entry).toHaveBeenCalledWith(path, { recursive: true })
    expect(write).not.toHaveBeenCalled()
  })

  it('removes folders of thoughts that are no longer in the library', async () => {
    const path = 'gone from the library'
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return { version: 2, thoughts: { 999: { path, key: 'v2|999||' } } }
      return null
    })
    get_directory_handle.mockImplementation(() =>
      Promise.resolve({ getFileHandle: get_file_handle })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(remove_entry).toHaveBeenCalledWith(path, { recursive: true })
  })

  it('stops syncing quietly when a run is cancelled mid-flight', async () => {
    mock_figure_show.value = false
    const { sync_now, cancel_folder_sync, folder_sync_status, folder_sync_error } =
      with_setup(() => use(), { provide: { set_working } })
    await flushPromises()

    const pending = sync_now()
    await flushPromises()
    cancel_folder_sync()
    mock_sync_folder_pref.value = false
    await pending
    await flushPromises()

    expect(folder_sync_status.value).toBe('idle')
    expect(folder_sync_error.value).toBeNull()
  })

  it('writes one note per thought and keeps the folder in step afterwards', async () => {
    mock_thoughts_for_author.mockReturnValueOnce([
      {
        author_id: me,
        started_at: 1000,
        posters: [],
        statements: [{ id: `${me}/statements/1`, statement: 'first light' }]
      }
    ])
    const { sync_now, sync_folder_name, folder_sync_last_at } = with_setup(
      () => use(),
      { provide: { set_working } }
    )
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(write).toHaveBeenCalled()
    expect(sync_folder_name.value).toBe('Exports')
    expect(typeof folder_sync_last_at.value).toBe('string')
    const saved = set.mock.calls.find(([k]) => k === 'sync:folder-manifest')?.[1]
    expect(saved.thoughts['1000']).toBeTruthy()
  })

  it('keeps an old format version while thoughts are still waiting', async () => {
    vi.useFakeTimers()
    try {
      const thoughts = Array.from({ length: 30 }, (_, index) => ({
        author_id: me,
        started_at: 1000 + index,
        posters: [],
        statements: [
          { id: `${me}/statements/${1000 + index}`, statement: `note ${index}` }
        ]
      }))
      mock_thoughts_for_author.mockReturnValueOnce(thoughts)
      const { sync_now, folder_sync_status } = with_setup(() => use(), {
        provide: { set_working }
      })
      await flushPromises()

      await sync_now()
      await flushPromises()

      const saved = set.mock.calls.find(
        ([k]) => k === 'sync:folder-manifest'
      )?.[1]
      expect(saved.version).toBe(0)
      expect(folder_sync_status.value).toBe('syncing')
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips an unchanged thought on a later sync', async () => {
    const path = '07-18 Saturday morning — hello'
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest')
        return {
          version: 2,
          thoughts: {
            1000: {
              path,
              key: `v2|1000|svg:true|${poster_id}|`
            }
          }
        }
      return null
    })
    get_file_handle.mockImplementation(() =>
      Promise.resolve({ createWritable: vi.fn() })
    )
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(write).not.toHaveBeenCalled()
    expect(mock_build_download_svg).not.toHaveBeenCalled()
  })

  it('sorts the newest thought first in the batch', async () => {
    mock_thoughts_for_author.mockReturnValueOnce([
      {
        author_id: me,
        started_at: 500,
        posters: [],
        statements: [{ id: `${me}/statements/500`, statement: 'older' }]
      },
      {
        author_id: me,
        started_at: 900,
        posters: [],
        statements: [{ id: `${me}/statements/900`, statement: 'newer' }]
      }
    ])
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    const written = write.mock.calls[0][0]
    const text = await written.text()
    expect(text).toContain('newer')
  })

  it('names the batch it is about to write', async () => {
    mock_thoughts_for_author.mockReturnValueOnce([
      {
        author_id: me,
        started_at: 1000,
        posters: [],
        statements: [{ id: `${me}/statements/1`, statement: 'one' }]
      }
    ])
    const { sync_now, folder_sync_progress } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()

    expect(folder_sync_progress.value.current).toBe(
      folder_sync_progress.value.total
    )
  })

  it('shows a shared drain instead of starting a second one', async () => {
    const first = drain_folder_queue({ force: true, set_working })
    const second = drain_folder_queue({ force: true, set_working })
    await Promise.all([first, second])
    await flushPromises()

    expect(get_directory_handle).toHaveBeenCalled()
  })

  it('skips a duplicate queue entry for the same item and action', async () => {
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return folder_handle
      if (k === 'sync:folder-queue')
        return [{ id: poster_id, action: 'save' }]
      if (k === 'sync:folder-manifest') return { thoughts: {} }
      return null
    })

    await enqueue_folder_sync(/** @type {any} */ (poster_id), 'save')

    expect(set).not.toHaveBeenCalledWith(
      'sync:folder-queue',
      expect.arrayContaining([
        expect.objectContaining({ id: poster_id, action: 'save' })
      ])
    )
  })

  it('ignores queue changes while the preference is off', async () => {
    mock_sync_folder_pref.value = false

    await enqueue_folder_sync(/** @type {any} */ (poster_id), 'delete')

    expect(set).not.toHaveBeenCalled()
  })

  it('picks a folder on the first sync and reuses it afterwards', async () => {
    let stored = null
    get.mockImplementation(async k => {
      if (k === 'sync_folder_handle') return stored
      if (k === 'sync:folder-queue') return []
      if (k === 'sync:folder-manifest') return { thoughts: {} }
      return null
    })
    set.mockImplementation(async (k, v) => {
      if (k === 'sync_folder_handle') stored = v
    })
    const { sync_folder } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_folder()
    expect(show_directory_picker).toHaveBeenCalledTimes(1)

    await sync_folder()
    await flushPromises()
    expect(show_directory_picker).toHaveBeenCalledTimes(1)
  })

  it('keeps a watching tab in step when it becomes visible again', async () => {
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()
    vi.useFakeTimers()

    document.dispatchEvent(new Event('visibilitychange'))
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    await flushPromises()

    expect(sync_now).toBeTypeOf('function')
  })

  it('reports Brave only when its own check says so', async () => {
    const { detect_brave } = await import('@/use/sync-folder')
    expect(await detect_brave()).toBe(false)

    Object.defineProperty(window.navigator, 'brave', {
      value: { isBrave: () => Promise.resolve(true) },
      configurable: true
    })
    expect(await detect_brave()).toBe(true)

    Object.defineProperty(window.navigator, 'brave', {
      value: {
        isBrave: () => Promise.reject(new Error('blocked'))
      },
      configurable: true
    })
    expect(await detect_brave()).toBe(false)
    delete (/** @type {any} */ (window.navigator).brave)
  })

  it('does not retry a failed thought until the next user-triggered sync', async () => {
    const error = silence_console('error')
    mock_export_ready.mockRejectedValue(new Error('symbols never loaded'))
    const { sync_now } = with_setup(() => use(), {
      provide: { set_working }
    })
    await flushPromises()

    await sync_now()
    await flushPromises()
    expect(mock_figure_props.length).toBe(1)
    expect(write).not.toHaveBeenCalled()

    await drain_folder_queue({ force: true, set_working })
    await flushPromises()
    expect(mock_figure_props.length).toBe(1)

    mock_export_ready.mockResolvedValue(undefined)
    await sync_now()
    await flushPromises()
    expect(mock_figure_props.length).toBe(2)
    expect(write).toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      '[sync-folder] skipped poster',
      poster_id,
      expect.any(Error)
    )
  })
})
