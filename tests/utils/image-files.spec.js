import { describe, it, expect } from 'vitest'
import {
  is_image_file,
  count_image_files,
  poster_filename
} from '@/utils/image-files'

describe('image-files utils', () => {
  describe('is_image_file', () => {
    it('returns true for all supported image extensions', () => {
      expect(is_image_file('test.jpg')).toBe(true)
      expect(is_image_file('test.JPG')).toBe(true)
      expect(is_image_file('test.jpeg')).toBe(true)
      expect(is_image_file('test.png')).toBe(true)
      expect(is_image_file('test.gif')).toBe(true)
      expect(is_image_file('test.webp')).toBe(true)
      expect(is_image_file('test.bmp')).toBe(true)
      expect(is_image_file('test.tiff')).toBe(true)
      expect(is_image_file('test.avif')).toBe(true)
      expect(is_image_file('test.svg')).toBe(true)
    })

    it('returns false for non-image files', () => {
      expect(is_image_file('test.txt')).toBe(false)
      expect(is_image_file('test.doc')).toBe(false)
      expect(is_image_file('test.pdf')).toBe(false)
      expect(is_image_file('test')).toBe(false)
      expect(is_image_file('test.jpg.backup')).toBe(false)
    })

    it('handles edge cases', () => {
      expect(is_image_file('.jpg')).toBe(true)
      expect(is_image_file('file.name.jpg')).toBe(true)
    })

    it('is case insensitive', () => {
      expect(is_image_file('test.JPG')).toBe(true)
      expect(is_image_file('test.PNG')).toBe(true)
      expect(is_image_file('test.Gif')).toBe(true)
    })
  })

  describe('count_image_files', () => {
    it('counts only image files', async () => {
      const entries = [
        ['image1.jpg', { kind: 'file' }],
        ['image2.png', { kind: 'file' }],
        ['not-image.txt', { kind: 'file' }],
        ['subdir', { kind: 'directory' }]
      ]
      const count = await count_image_files(entries)
      expect(count).toBe(2)
    })

    it('returns 0 for no images', async () => {
      const entries = [
        ['file1.txt', { kind: 'file' }],
        ['file2.doc', { kind: 'file' }]
      ]
      const count = await count_image_files(entries)
      expect(count).toBe(0)
    })

    it('ignores directories', async () => {
      const entries = [
        ['image.jpg', { kind: 'file' }],
        ['subdir', { kind: 'directory' }],
        ['another-dir', { kind: 'directory' }]
      ]
      const count = await count_image_files(entries)
      expect(count).toBe(1)
    })

    it('handles empty entries', async () => {
      const entries = []
      const count = await count_image_files(entries)
      expect(count).toBe(0)
    })

    it('counts all supported image formats', async () => {
      const entries = [
        ['a.jpg', { kind: 'file' }],
        ['b.jpeg', { kind: 'file' }],
        ['c.png', { kind: 'file' }],
        ['d.gif', { kind: 'file' }],
        ['e.webp', { kind: 'file' }],
        ['f.bmp', { kind: 'file' }],
        ['g.tiff', { kind: 'file' }],
        ['h.avif', { kind: 'file' }],
        ['i.svg', { kind: 'file' }]
      ]
      const count = await count_image_files(entries)
      expect(count).toBe(9)
    })
  })

  describe('poster_filename', () => {
    it('replaces extension with .svg', () => {
      expect(poster_filename('test.jpg')).toBe('test.svg')
      expect(poster_filename('image.png')).toBe('image.svg')
      expect(poster_filename('photo.jpeg')).toBe('photo.svg')
      expect(poster_filename('file.gif')).toBe('file.svg')
    })

    it('handles files without extension', () => {
      expect(poster_filename('test')).toBe('test.svg')
      expect(poster_filename('image')).toBe('image.svg')
    })

    it('handles files with multiple dots', () => {
      expect(poster_filename('my.image.jpg')).toBe('my.image.svg')
      expect(poster_filename('file.backup.png')).toBe('file.backup.svg')
    })

    it('handles files starting with dot', () => {
      expect(poster_filename('.hidden.jpg')).toBe('.hidden.svg')
    })

    it('handles empty string', () => {
      expect(poster_filename('')).toBe('.svg')
    })
  })
})
