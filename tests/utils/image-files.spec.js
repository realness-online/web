import { describe, it, expect } from 'vitest'
import { is_image_file, count_image_files, poster_filename } from '@/utils/image-files'

describe('image-files utils', () => {
  describe('is_image_file', () => {
    it('returns true for image extensions', () => {
      expect(is_image_file('test.jpg')).toBe(true)
      expect(is_image_file('test.JPG')).toBe(true)
      expect(is_image_file('test.png')).toBe(true)
      expect(is_image_file('test.gif')).toBe(true)
      expect(is_image_file('test.webp')).toBe(true)
    })

    it('returns false for non-image files', () => {
      expect(is_image_file('test.txt')).toBe(false)
      expect(is_image_file('test.doc')).toBe(false)
      expect(is_image_file('test')).toBe(false)
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
  })

  describe('poster_filename', () => {
    it('replaces extension with .svg', () => {
      expect(poster_filename('test.jpg')).toBe('test.svg')
      expect(poster_filename('image.png')).toBe('image.svg')
      expect(poster_filename('photo.jpeg')).toBe('photo.svg')
    })

    it('handles files without extension', () => {
      expect(poster_filename('test')).toBe('test.svg')
    })
  })
})

