import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
vi.mock('idb-keyval', () => import('./fake-idb.js'))
import * as idb from 'idb-keyval'
import { make_backend, make_store, VOCABULARY } from './fake.js'

const element = itemid => {
  const el = document.createElement('article')
  el.setAttribute('itemid', itemid)
  el.innerHTML = '<p>one</p>'
  return el
}

const three_items = () => ({
  items: [
    { name: '1000.html.gz' },
    { name: '2000.html.gz' },
    { name: '3000.html.gz' }
  ],
  prefixes: []
})

describe('Cloud mixin', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('uploads the serialized document to the path paths reports', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    const poster = new Poster('/+1/posters/1000')
    const el = element(poster.id)

    await poster.to_network(el)

    expect(backend.upload).toHaveBeenCalledWith(
      'files/+1/posters/1000.html.gz',
      el.outerHTML,
      { contentType: 'text/html' }
    )
  })

  it('uses backend.serialize when the app has one', async () => {
    const backend = make_backend({
      serialize: vi.fn(async () => ({
        compressed: 'zip',
        metadata: { contentType: 'text/html', contentEncoding: 'deflate' }
      }))
    })
    const { Cloud, Storage } = make_store({ backend })
    class Poster extends Cloud(Storage) {}

    await new Poster('/+1/posters/1000').to_network('html')

    expect(backend.upload).toHaveBeenCalledWith(
      'files/+1/posters/1000.html.gz',
      'zip',
      { contentType: 'text/html', contentEncoding: 'deflate' }
    )
  })

  it('calls after_upload and drops the cached directory', async () => {
    const backend = make_backend({ after_upload: vi.fn(async () => {}) })
    const { Cloud, Storage } = make_store({ backend })
    class Poster extends Cloud(Storage) {}
    await idb.set('/+1/posters/', {
      id: '/+1/posters/',
      types: [],
      archive: [],
      items: [1000]
    })

    await new Poster('/+1/posters/1000').to_network(element('/+1/posters/1000'))

    expect(backend.after_upload).toHaveBeenCalledWith(
      '/+1/posters/1000',
      'files/+1/posters/1000.html.gz',
      { ok: true }
    )
    expect(await idb.get('/+1/posters/')).toBeUndefined()
  })

  it('queues a save for later when offline', async () => {
    const backend = make_backend({
      online: () => false,
      later: vi.fn(async () => {})
    })
    const { Cloud, Storage } = make_store({ backend })
    class Poster extends Cloud(Storage) {}

    await new Poster('/+1/posters/1000').to_network(element('/+1/posters/1000'))

    expect(backend.upload).not.toHaveBeenCalled()
    expect(backend.later).toHaveBeenCalledWith('/+1/posters/1000', 'save')
  })

  it('save uploads only networkable types', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    class Thought extends Cloud(Storage) {}

    await new Thought('/+1/thoughts/1000').save(element('/+1/thoughts/1000'))
    expect(backend.upload).not.toHaveBeenCalled()

    await new Poster('/+1/posters/1000').save(element('/+1/posters/1000'))
    expect(backend.upload).toHaveBeenCalledTimes(1)
  })

  it('delete removes every file when online', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}

    await new Poster('/+1/posters/1000').delete()

    expect(backend.remove).toHaveBeenCalledWith('files/+1/posters/1000.html.gz')
    expect(backend.remove).toHaveBeenCalledWith(
      'files/+1/posters/1000-shadows.html.gz'
    )
    expect(backend.remove).toHaveBeenCalledWith(
      'files/+1/posters/1000-sand.html.gz'
    )
  })

  it('delete queues for later when offline', async () => {
    const backend = make_backend({
      online: () => false,
      later: vi.fn(async () => {})
    })
    const { Cloud, Storage } = make_store({ backend })
    class Poster extends Cloud(Storage) {}

    await new Poster('/+1/posters/1000').delete()

    expect(backend.remove).not.toHaveBeenCalled()
    expect(backend.later).toHaveBeenCalledWith('/+1/posters/1000', 'delete')
  })

  it('optimize moves every file of the oldest items together', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    backend.directory.mockResolvedValueOnce(three_items()).mockResolvedValue({
      items: [{ name: '2000.html.gz' }, { name: '3000.html.gz' }],
      prefixes: []
    })

    await new Poster('/+1/posters').optimize()

    expect(backend.move).toHaveBeenCalledWith(
      'files/+1/posters/1000.html.gz',
      'people/+1/posters/1000/1000.html.gz'
    )
    expect(backend.move).toHaveBeenCalledWith(
      'files/+1/posters/1000-shadows.html.gz',
      'people/+1/posters/1000/1000-shadows.html.gz'
    )
    expect(backend.move).toHaveBeenCalledTimes(3)
  })

  it('optimize does nothing when the directory is within limits', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    backend.directory.mockResolvedValue({
      items: [{ name: '2000.html.gz' }, { name: '3000.html.gz' }],
      prefixes: []
    })

    await new Poster('/+1/posters').optimize()

    expect(backend.move).not.toHaveBeenCalled()
  })

  it('optimize does nothing for a type that does not archive', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Thought extends Cloud(Storage) {}

    await new Thought('/+1/thoughts').optimize()

    expect(backend.directory).not.toHaveBeenCalled()
    expect(backend.move).not.toHaveBeenCalled()
  })

  it('optimize archiving keeps whole items together across a batch', async () => {
    const store = make_store({
      vocabulary: { ...VOCABULARY, sizes: { ...VOCABULARY.sizes, MID: 2 } }
    })
    const { Cloud, Storage, backend } = store
    class Poster extends Cloud(Storage) {}
    backend.directory
      .mockResolvedValueOnce({
        items: [
          { name: '1000.html.gz' },
          { name: '2000.html.gz' },
          { name: '3000.html.gz' },
          { name: '4000.html.gz' }
        ],
        prefixes: []
      })
      .mockResolvedValue({
        items: [{ name: '3000.html.gz' }, { name: '4000.html.gz' }],
        prefixes: []
      })

    await new Poster('/+1/posters').optimize()

    expect(backend.move).toHaveBeenCalledTimes(6)
    expect(backend.move).toHaveBeenCalledWith(
      'files/+1/posters/2000.html.gz',
      'people/+1/posters/1000/2000.html.gz'
    )
    expect(backend.move).toHaveBeenCalledWith(
      'files/+1/posters/1000.html.gz',
      'people/+1/posters/1000/1000.html.gz'
    )
  })

  it('optimize retries a failed batch once, then stops', async () => {
    const console_error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    backend.move.mockResolvedValue(false)
    backend.directory.mockResolvedValue(three_items())

    await new Poster('/+1/posters').optimize()

    expect(backend.directory).toHaveBeenCalledTimes(2)
    console_error.mockRestore()
  })

  it('optimize recurses while the directory still exceeds the limit', async () => {
    const console_error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    backend.directory
      .mockResolvedValueOnce(three_items())
      .mockResolvedValueOnce(three_items())
      .mockResolvedValueOnce(three_items())
      .mockResolvedValue({
        items: [{ name: '2000.html.gz' }, { name: '3000.html.gz' }],
        prefixes: []
      })

    await new Poster('/+1/posters').optimize()

    expect(backend.directory).toHaveBeenCalledTimes(4)
    expect(backend.move).toHaveBeenCalledTimes(6)
    console_error.mockRestore()
  })

  it('optimize rolls a partial move back', async () => {
    const { Cloud, Storage, backend } = make_store()
    class Poster extends Cloud(Storage) {}
    backend.move.mockImplementation(async from => !from.includes('-sand'))
    backend.directory.mockResolvedValueOnce(three_items()).mockResolvedValue({
      items: [{ name: '2000.html.gz' }, { name: '3000.html.gz' }],
      prefixes: []
    })

    await new Poster('/+1/posters').optimize()

    expect(backend.move).toHaveBeenCalledWith(
      'people/+1/posters/1000/1000.html.gz',
      'files/+1/posters/1000.html.gz'
    )
    expect(backend.move).toHaveBeenCalledWith(
      'people/+1/posters/1000/1000-shadows.html.gz',
      'files/+1/posters/1000-shadows.html.gz'
    )
  })
})
