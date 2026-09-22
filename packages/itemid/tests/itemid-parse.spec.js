import { describe, it, expect } from 'vite-plus/test'
import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  is_itemid,
  create_itemid
} from '../src/index.js'

describe('as_path_parts', () => {
  it('returns an empty array for falsy or non-string input', () => {
    expect(as_path_parts('')).toEqual([])
    expect(as_path_parts(undefined)).toEqual([])
    expect(as_path_parts(null)).toEqual([])
    expect(as_path_parts(123)).toEqual([])
  })

  it('splits a full item path into author, type, created', () => {
    expect(as_path_parts('/+123/thoughts/789')).toEqual([
      '+123',
      'thoughts',
      '789'
    ])
  })

  it('marks a type-only trailing slash as an index', () => {
    expect(as_path_parts('/+123/thoughts/')).toEqual([
      '+123',
      'thoughts',
      'index',
      ''
    ])
  })

  it('preserves a created value on a trailing-slash path', () => {
    expect(as_path_parts('/+123/thoughts/789/')).toEqual([
      '+123',
      'thoughts',
      '',
      '789'
    ])
  })
})

describe('as_author', () => {
  it('returns the author with a leading slash when it starts with +', () => {
    expect(as_author('/+123/thoughts/789')).toBe('/+123')
  })

  it('returns null when the id has no author', () => {
    expect(as_author('')).toBeNull()
    expect(as_author('/plain/thoughts/789')).toBeNull()
  })
})

describe('as_type', () => {
  it('returns null for missing or non-string input', () => {
    expect(as_type(null)).toBeNull()
    expect(as_type(undefined)).toBeNull()
    expect(as_type(42)).toBeNull()
  })

  it('maps statements to thoughts', () => {
    expect(as_type('/+123/statements/1')).toBe('thoughts')
  })

  it('returns a known type member directly', () => {
    expect(as_type('/+123/thoughts/1')).toBe('thoughts')
    expect(as_type('/+123/posters/1')).toBe('posters')
  })

  it('treats a bare /+ path as a person', () => {
    expect(as_type('/+123')).toBe('person')
  })

  it('returns null for an unknown type without an author prefix', () => {
    expect(as_type('/+123/unknownthing/1')).toBe('person')
    expect(as_type('x')).toBeNull()
  })
})

describe('as_created_at', () => {
  it('returns null when there is no id', () => {
    expect(as_created_at(null)).toBeNull()
    expect(as_created_at('')).toBeNull()
  })

  it('parses the created timestamp from a three-part path', () => {
    expect(as_created_at('/+123/thoughts/789')).toBe(789)
  })

  it('parses the created timestamp from a trailing-slash path', () => {
    expect(as_created_at('/+123/thoughts/789/')).toBe(789)
  })

  it('returns null when no created part exists', () => {
    expect(as_created_at('/+123/thoughts')).toBeNull()
    // an index marker parses to NaN rather than a timestamp
    expect(Number.isNaN(as_created_at('/+123/thoughts/index'))).toBe(true)
  })
})

describe('is_itemid', () => {
  it('rejects non-strings and ids without a leading slash', () => {
    expect(is_itemid(123)).toBe(false)
    expect(is_itemid('nope')).toBe(false)
  })

  it('rejects malformed part counts', () => {
    expect(is_itemid('/+123')).toBe(false)
    expect(is_itemid('/+123/thoughts/1/extra')).toBe(false)
  })

  it('rejects ids whose author does not start with +', () => {
    expect(is_itemid('/plain/thoughts/1')).toBe(false)
  })

  it('rejects ids with an unknown type', () => {
    expect(is_itemid('/+123/unknown/1')).toBe(false)
  })

  it('requires a timestamp for posters', () => {
    expect(is_itemid('/+123/posters')).toBe(false)
    expect(is_itemid('/+123/posters/abc')).toBe(false)
    expect(is_itemid('/+123/posters/123')).toBe(true)
  })

  it('accepts a well-formed thoughts id', () => {
    expect(is_itemid('/+123/thoughts/1')).toBe(true)
  })
})

describe('create_itemid', () => {
  const app = create_itemid({ types: ['notes'], requires_timestamp: [] })

  it('accepts the app vocabulary and rejects the default one', () => {
    expect(app.as_type('/+123/notes/1')).toBe('notes')
    expect(app.is_itemid('/+123/notes/1')).toBe(true)
    expect(app.is_itemid('/+123/thoughts/1')).toBe(false)
  })

  it('drops the timestamp rule when the vocabulary does not ask for it', () => {
    expect(app.is_itemid('/+123/notes')).toBe(true)
    expect(is_itemid('/+123/posters')).toBe(false)
  })

  it('shares the vocabulary-free parsers', () => {
    expect(app.as_path_parts('/+123/notes/1')).toEqual(['+123', 'notes', '1'])
    expect(app.as_author('/+123/notes/1')).toBe('/+123')
    expect(app.as_created_at('/+123/notes/1')).toBe(1)
  })
})
