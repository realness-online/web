import { describe, it, expect } from 'vitest'
import { unique_html_files } from '#services/html-files.js'

const old = { name: 'people/+1/statements/index.html.gz' }
const current = { name: 'people/+1/statements/index.html' }
const archive = { name: 'people/+1/statements/123.html' }

describe('unique_html_files', () => {
  it.each([[old, current], [current, old]])('reads each logical file once', (...files) => {
    expect(unique_html_files(files)).toEqual([old])
  })

  it('accepts both suffixes and keeps archive pages distinct', () => {
    expect(unique_html_files([old, archive, { name: 'photo.jpg' }])).toEqual([
      old, archive
    ])
    expect(unique_html_files([current])).toEqual([current])
  })

  it('ignores suffix lookalikes', () => {
    expect(unique_html_files([
      { name: 'index.html.gz.extra' },
      { name: 'index.html.gzip' }
    ])).toEqual([])
  })
})
