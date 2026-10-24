import { describe, it, expect } from 'vitest'
import { unique_html_files } from '#services/html-files.js'

const retired = { name: 'people/+1/statements/index.html.gz' }
const current = { name: 'people/+1/statements/index.html' }
const archive = { name: 'people/+1/statements/123.html' }

describe('unique_html_files', () => {
  it('reads .html pages, live and archived, and skips the retired name', () => {
    expect(
      unique_html_files([retired, current, archive, { name: 'photo.jpg' }])
    ).toEqual([current, archive])
  })

  it('ignores suffix lookalikes', () => {
    expect(unique_html_files([
      { name: 'index.html.gz.extra' },
      { name: 'index.html.gzip' }
    ])).toEqual([])
  })
})
