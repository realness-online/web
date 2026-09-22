import { vi } from 'vite-plus/test'
import { as_path_parts } from '@realness/itemid'
import { create_store } from '../src/index.js'

// Two types is enough to exercise networkable, archived, and paged separately.
export const VOCABULARY = {
  types: ['posters', 'thoughts'],
  requires_timestamp: ['posters'],
  networkable: ['posters'],
  archived: ['posters'],
  paged: ['thoughts'],
  sizes: { MIN: 1, MID: 1, MAX: 2, TARGET_SIZE: 512 }
}

export const make_backend = (overrides = {}) => ({
  upload: vi.fn(async () => ({ ok: true })),
  remove: vi.fn(async () => {}),
  move: vi.fn(async () => true),
  url: vi.fn(async path => `https://example.test/${path}`),
  directory: vi.fn(async () => ({ items: [], prefixes: [] })),
  online: () => true,
  signed_in: () => true,
  ...overrides
})

const directory_id = itemid => {
  const [author, type, , archive] = as_path_parts(itemid)
  if (archive && archive !== 'index') return `/${author}/${type}/${archive}/`
  return `/${author}/${type}/`
}

const as_path = itemid => itemid.replace(/^\//, '')

export const make_paths = (overrides = {}) => ({
  storage_path: vi.fn(async itemid => `files/${as_path(itemid)}.html.gz`),
  directory_id: vi.fn(directory_id),
  directory_path: vi.fn(itemid => `people${directory_id(itemid)}`),
  archive_path: vi.fn((itemid, archive_id) => {
    const [author, type, created] = as_path_parts(itemid)
    return `people/${author}/${type}/${archive_id}/${created}`
  }),
  created_at_from_filename: vi.fn(name => {
    const [filename] = name.split('.')
    if (filename.includes('-')) return null
    const created = parseInt(filename)
    return Number.isNaN(created) ? null : created
  }),
  files: vi.fn(async (itemid, archive_id = null) => {
    const path = archive_id
      ? `people/${as_path(itemid)}`
      : `files/${as_path(itemid)}`
    return [
      `${path}.html.gz`,
      `${path}-shadows.html.gz`,
      `${path}-sand.html.gz`
    ]
  }),
  siblings: vi.fn(() => []),
  ...overrides
})

export const make_store = ({
  backend = make_backend(),
  paths = make_paths(),
  vocabulary = VOCABULARY
} = {}) => create_store({ backend, paths, vocabulary })
