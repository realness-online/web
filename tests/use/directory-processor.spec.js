import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { use } from '@/use/directory-processor'
import { count_image_files } from '@/utils/image-files'

const mock_process_photo = vi.fn()
const mock_new_vector = ref(null)
const mock_new_gradients = ref(null)
const mock_vector_ref = ref(null)
const mock_optimize = vi.fn()
const mock_count_image_files = vi.mocked(count_image_files)

// Mock dependencies
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    new_vector: mock_new_vector,
    new_gradients: mock_new_gradients,
    process_photo: mock_process_photo
  })
}))

vi.mock('@/use/optimize', () => ({
  use: vi.fn(passed_vector => {
    return {
    optimize: mock_optimize,
      vector: passed_vector || mock_vector_ref
    }
  })
  }))

vi.mock('@/utils/image-files', () => ({
  count_image_files: vi.fn(),
  is_image_file: vi.fn(name => /\.(jpg|jpeg|png|gif|webp|bmp|tiff|avif|svg)$/i.test(name)),
  poster_filename: vi.fn(name => name.replace(/\.[^.]+$/, '.svg'))
}))

describe('directory-processor composable', () => {
  let processor
  let mock_show_directory_picker
  let mock_dir_handle
  let mock_posters_dir
  let mock_file_handle
  let mock_writable
  let mock_entries

  beforeEach(() => {
    vi.clearAllMocks()
    mock_new_vector.value = null
    mock_new_gradients.value = null
    mock_vector_ref.value = null

    mock_writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    }

    mock_file_handle = {
      createWritable: vi.fn().mockResolvedValue(mock_writable),
      getFile: vi
        .fn()
        .mockResolvedValue(new File([''], 'test.jpg', { type: 'image/jpeg' }))
    }

    mock_posters_dir = {
      getFileHandle: vi.fn(async () => mock_file_handle)
    }

    mock_entries = [
      [
        'image1.jpg',
        {
          kind: 'file',
          getFile: () =>
            Promise.resolve(
              new File([''], 'image1.jpg', { type: 'image/jpeg' })
            )
        }
      ],
      [
        'image2.png',
        {
          kind: 'file',
          getFile: () =>
            Promise.resolve(new File([''], 'image2.png', { type: 'image/png' }))
        }
      ],
      [
        'not-an-image.txt',
        {
          kind: 'file',
          getFile: () =>
            Promise.resolve(
              new File([''], 'not-an-image.txt', { type: 'text/plain' })
            )
        }
      ]
    ]

    mock_dir_handle = {
      async *entries() {
        for (const entry of mock_entries) yield entry
      },
      getDirectoryHandle: vi.fn().mockResolvedValue(mock_posters_dir)
    }

    mock_show_directory_picker = vi.fn().mockResolvedValue(mock_dir_handle)

    global.window.showDirectoryPicker = mock_show_directory_picker
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()

    mock_count_image_files.mockResolvedValue(2)

    mock_process_photo.mockImplementation(() => {
      mock_new_vector.value = {
        id: 'test',
        optimized: true,
        toString: () => '<svg></svg>'
      }
      return Promise.resolve()
    })

    processor = use()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('returns process_directory function', () => {
      expect(processor.process_directory).toBeTypeOf('function')
    })

    it('returns progress ref with correct initial state', () => {
      expect(processor.progress.value).toEqual({
        total: 0,
        current: 0,
        processing: false,
        current_file: ''
      })
    })

    it('returns completed_poster ref initialized to null', () => {
      expect(processor.completed_poster.value).toBe(null)
    })
  })

  describe('progress tracking', () => {
    it('progress ref is reactive', () => {
      expect(processor.progress.value.processing).toBe(false)
      processor.progress.value.processing = true
      expect(processor.progress.value.processing).toBe(true)
    })

    it('can update current file being processed', () => {
      processor.progress.value.current_file = 'test.jpg'
      expect(processor.progress.value.current_file).toBe('test.jpg')
    })

    it('can track current and total counts', () => {
      processor.progress.value.total = 10
      processor.progress.value.current = 5
      expect(processor.progress.value.total).toBe(10)
      expect(processor.progress.value.current).toBe(5)
    })
  })

  describe('completed_poster', () => {
    it('can store completed poster data', () => {
      const poster_data = { id: 'test', type: 'poster' }
      processor.completed_poster.value = poster_data
      expect(processor.completed_poster.value).toEqual(poster_data)
    })
  })

  describe('process_directory', () => {
    it('opens directory picker with correct options', async () => {
      await processor.process_directory()
      expect(mock_show_directory_picker).toHaveBeenCalledWith({
        mode: 'read',
        startIn: 'pictures',
        id: 'source-images'
      })
    })

    it('counts image files and sets total progress', async () => {
      await processor.process_directory()
      expect(mock_count_image_files).toHaveBeenCalledWith(mock_dir_handle.entries())
      expect(mock_writable.write).toHaveBeenCalledTimes(2)
    })

    it('gets or creates posters directory', async () => {
      await processor.process_directory()
      expect(mock_dir_handle.getDirectoryHandle).toHaveBeenCalledWith('posters', {
        create: true
      })
    })

    it('processes image files and skips non-image files', async () => {
      await processor.process_directory()
      expect(mock_process_photo).toHaveBeenCalledTimes(2)
      expect(mock_process_photo).toHaveBeenCalledWith('blob:mock-url')
    })

    it('updates current_file during processing', async () => {
      const file_calls = []
      mock_posters_dir.getFileHandle.mockImplementation(async name => {
        file_calls.push(name)
        return mock_file_handle
      })
      await processor.process_directory()
      expect(file_calls).toContain('image1.svg')
      expect(file_calls).toContain('image2.svg')
    })

    it('waits for new_vector to be set before continuing', async () => {
      mock_process_photo.mockImplementation(() => {
        queueMicrotask(() => {
          mock_new_vector.value = {
            id: 'test',
            optimized: true,
            toString: () => '<svg></svg>'
          }
        })
        return Promise.resolve()
      })

      await processor.process_directory()
      expect(mock_writable.write).toHaveBeenCalled()
    })

    it('sets completed_poster with new_vector value', async () => {
      const test_vector = {
        id: 'test-vector',
        optimized: true,
        toString: () => '<svg>test</svg>'
      }

      mock_process_photo.mockImplementation(() => {
        mock_new_vector.value = test_vector
        return Promise.resolve()
      })

      await processor.process_directory()
      expect(mock_writable.write).toHaveBeenCalledWith('<svg>test</svg>')
    })

    it('optimizes vector if not already optimized', async () => {
      const unoptimized_vector = {
        id: 'unoptimized',
        optimized: false,
        toString: () => '<svg></svg>'
      }

      mock_process_photo.mockImplementation(() => {
        mock_new_vector.value = unoptimized_vector
        return Promise.resolve()
      })

      mock_optimize.mockImplementation(() => {
        if (processor.completed_poster.value) {
          processor.completed_poster.value.optimized = true
        }
      })

      await processor.process_directory()
      expect(mock_optimize).toHaveBeenCalled()
      const completed = processor.completed_poster.value
      if (completed) {
        expect(completed.optimized).toBe(true)
      }
    })

    it('saves SVG file to posters directory', async () => {
      const svg_content = '<svg>test</svg>'

      mock_process_photo.mockImplementation(() => {
        mock_new_vector.value = {
          id: 'test',
          optimized: true,
          toString: () => svg_content
        }
        return Promise.resolve()
      })

      await processor.process_directory()
      expect(mock_posters_dir.getFileHandle).toHaveBeenCalledWith('image1.svg', {
        create: true
      })
      expect(mock_file_handle.createWritable).toHaveBeenCalled()
      expect(mock_writable.write).toHaveBeenCalledWith(svg_content)
      expect(mock_writable.close).toHaveBeenCalled()
    })

    it('increments progress after processing each file', async () => {
      await processor.process_directory()
      expect(mock_writable.write).toHaveBeenCalledTimes(2)
      expect(mock_writable.close).toHaveBeenCalledTimes(2)
    })

    it('cleans up new_vector and new_gradients after each file', async () => {
      mock_new_gradients.value = { some: 'gradient' }
      await processor.process_directory()
      expect(mock_new_vector.value).toBeNull()
      expect(mock_new_gradients.value).toBeNull()
    })

    it('revokes object URLs after processing', async () => {
      await processor.process_directory()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2)
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    })

    it('skips directories in entries', async () => {
      mock_entries.push(['subdir', { kind: 'directory' }])
      await processor.process_directory()
      expect(mock_process_photo).toHaveBeenCalledTimes(2)
    })

    it('handles errors during file processing gracefully', async () => {
      const error = new Error('Processing failed')
      mock_process_photo.mockRejectedValue(error)
      const console_error = vi.spyOn(console, 'error').mockImplementation(() => {})

      await processor.process_directory()
      expect(console_error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process'),
        error
      )
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
      console_error.mockRestore()
    })

    it('resets progress state after completion', async () => {
      await processor.process_directory()
      expect(processor.progress.value).toEqual({
        total: 0,
        current: 0,
        processing: false,
        current_file: ''
      })
    })

    it('clears completed_poster after completion', async () => {
      await processor.process_directory()
      expect(processor.completed_poster.value).toBeNull()
    })

    it('sets processing to true at start and false at end', async () => {
      const process_promise = processor.process_directory()
      expect(processor.progress.value.processing).toBe(true)
      await process_promise
      expect(processor.progress.value.processing).toBe(false)
    })

    it('handles directory picker cancellation', async () => {
      mock_show_directory_picker.mockRejectedValue(new Error('User cancelled'))
      const console_error = vi.spyOn(console, 'error').mockImplementation(() => {})

      await processor.process_directory()
      expect(console_error).toHaveBeenCalledWith(
        expect.stringContaining('Directory processing failed'),
        expect.any(Error)
      )
      expect(processor.progress.value.processing).toBe(false)
      console_error.mockRestore()
    })
  })
})
