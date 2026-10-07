import { describe, it, expect, beforeEach } from 'vite-plus/test'
import { create_store } from '../src/index.js'
import { local } from '../src/local-only.js'

const vocabulary = {
  types: ['notes'],
  requires_timestamp: ['notes'],
  networkable: [],
  archived: [],
  paged: [],
  sizes: { MIN: 1, MID: 5, MAX: 10, TARGET_SIZE: 512 }
}

describe('local', () => {
  beforeEach(() => localStorage.clear())

  it('builds a store that never goes online', () => {
    const store = create_store({ ...local(), vocabulary })
    expect(store.backend.online()).toBe(false)
    expect(store.backend.signed_in()).toBe(false)
  })

  it('saves through the Local mixin to localStorage', () => {
    const { Storage, Local } = create_store({ ...local(), vocabulary })
    class Note extends Local(Storage) {}
    const note = new Note('/+1/notes/1700000000000')
    note.save({
      outerHTML: '<article itemid="/+1/notes/1700000000000"></article>'
    })
    expect(localStorage.getItem('/+1/notes/1700000000000')).toContain(
      '<article'
    )
  })

  it('maps an itemid to its directory', () => {
    const { paths } = local()
    expect(paths.directory_id('/+1/notes/1700000000000')).toBe('/+1/notes/')
  })
})
