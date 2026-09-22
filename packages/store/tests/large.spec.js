import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
vi.mock('idb-keyval', () => import('./fake-idb.js'))
import * as idb from 'idb-keyval'
import { make_paths, make_store } from './fake.js'

const element = itemid => {
  const el = document.createElement('article')
  el.setAttribute('itemid', itemid)
  el.innerHTML = '<p>one</p>'
  return el
}

describe('Large mixin', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('caches the html and opens a directory row', async () => {
    const { Large, Storage } = make_store()
    class Poster extends Large(Storage) {}
    const poster = new Poster('/+1/posters/1000')

    await poster.save(element(poster.id))

    expect(await idb.get('/+1/posters/1000')).toBe(element(poster.id).outerHTML)
    expect(await idb.get('/+1/posters/')).toEqual({
      id: '/+1/posters/',
      types: [],
      archive: [],
      items: [1000]
    })
  })

  it('appends a created_at the directory row does not have', async () => {
    const { Large, Storage } = make_store()
    class Poster extends Large(Storage) {}
    await idb.set('/+1/posters/', {
      id: '/+1/posters/',
      types: [],
      archive: [],
      items: [2000]
    })

    await new Poster('/+1/posters/1000').save(element('/+1/posters/1000'))

    expect((await idb.get('/+1/posters/')).items).toEqual([2000, 1000])
  })

  it('does nothing without an element', async () => {
    const { Large, Storage } = make_store()
    class Poster extends Large(Storage) {}

    await new Poster('/+1/posters/1000').save()

    expect(await idb.get('/+1/posters/1000')).toBeUndefined()
    expect(await idb.get('/+1/posters/')).toBeUndefined()
  })

  it('delete removes the item, its siblings, and its directory entry', async () => {
    const { Large, Storage } = make_store({
      paths: make_paths({ siblings: () => ['/+1/shadows/1000'] })
    })
    class Poster extends Large(Storage) {}
    await idb.set('/+1/posters/1000', '<article></article>')
    await idb.set('/+1/shadows/1000', '<svg></svg>')
    await idb.set('/+1/posters/', {
      id: '/+1/posters/',
      types: [],
      archive: [],
      items: [1000, 2000]
    })

    await new Poster('/+1/posters/1000').delete()

    expect(await idb.get('/+1/posters/1000')).toBeUndefined()
    expect(await idb.get('/+1/shadows/1000')).toBeUndefined()
    expect((await idb.get('/+1/posters/')).items).toEqual([2000])
  })

  it('get_storage_path asks paths', async () => {
    const { Large, Storage, paths } = make_store()
    class Poster extends Large(Storage) {}
    const poster = new Poster('/+1/posters/1000')

    expect(await poster.get_storage_path()).toBe(
      'files/+1/posters/1000.html.gz'
    )
    expect(paths.storage_path).toHaveBeenCalledWith('/+1/posters/1000')
  })
})
