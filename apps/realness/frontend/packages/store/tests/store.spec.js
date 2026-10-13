import { describe, it, expect, beforeEach } from 'vite-plus/test'
import { create_store } from '../src/index.js'

const vocabulary = {
  types: ['notes', 'me'],
  requires_timestamp: ['notes'],
  networkable: ['notes'],
  archived: ['notes'],
  paged: [],
  sizes: { MIN: 1, MID: 5, MAX: 10, TARGET_SIZE: 512 }
}

const backend = {
  upload: async () => ({}),
  remove: async () => {},
  move: async () => true,
  url: async () => '',
  directory: async () => ({ items: [], prefixes: [] }),
  online: () => true,
  signed_in: () => false
}

const paths = {
  storage_path: async itemid => `${itemid}.html.gz`,
  directory_id: itemid => `${itemid}/`,
  files: async itemid => [`${itemid}.html.gz`],
  siblings: () => []
}

const make_store = () => create_store({ backend, paths, vocabulary })

describe('create_store', () => {
  it('needs a vocabulary, a backend, and paths', () => {
    expect(() => create_store()).toThrow(/vocabulary.types/)
    expect(() => create_store({ vocabulary, paths })).toThrow(/backend/)
    expect(() => create_store({ vocabulary, backend })).toThrow(/paths/)
  })

  it('derives the type from the itemid with the store vocabulary', () => {
    const { Storage } = make_store()
    const note = new Storage('/+123/notes/456')
    expect(note.id).toBe('/+123/notes/456')
    expect(note.type).toBe('notes')
  })

  it('does not know a type outside its vocabulary', () => {
    const { Storage } = make_store()
    expect(new Storage('/+123/posters/456').type).toBe('person')
  })
})

describe('Local', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('saves the element outerHTML under the itemid', () => {
    const { Storage, Local } = make_store()
    class Note extends Local(Storage) {}
    const note = new Note('/+123/notes/456')

    const el = document.createElement('article')
    el.setAttribute('itemid', note.id)
    document.body.append(el)

    note.save()

    expect(localStorage.getItem(note.id)).toBe(el.outerHTML)
  })

  it('does nothing without an element', () => {
    const { Storage, Local } = make_store()
    class Note extends Local(Storage) {}
    const note = new Note('/+123/notes/456')

    note.save()

    expect(localStorage.getItem(note.id)).toBeNull()
  })
})
