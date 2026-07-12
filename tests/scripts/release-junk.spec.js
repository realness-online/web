import { describe, it, expect } from 'vite-plus/test'
import { is_release_junk } from '../../scripts/release-junk.js'

describe('is_release_junk', () => {
  it('flags Finder, Windows, and macOS archive junk', () => {
    expect(is_release_junk('/screentones/.DS_Store')).toBe(true)
    expect(is_release_junk('Thumbs.db')).toBe(true)
    expect(is_release_junk('assets/desktop.ini')).toBe(true)
    expect(is_release_junk('__MACOSX/foo')).toBe(true)
    expect(is_release_junk('/.hidden/file.txt')).toBe(true)
  })

  it('allows normal release paths', () => {
    expect(is_release_junk('/index.html')).toBe(false)
    expect(is_release_junk('/screentones/1974.webp')).toBe(false)
    expect(is_release_junk('/assets/index-abc.js')).toBe(false)
  })
})
