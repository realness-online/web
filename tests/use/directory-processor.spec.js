import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { use } from '@/use/directory-processor'

const mock_process_photo = vi.fn()
const mock_new_vector = ref(null)
const mock_new_gradients = ref(null)
const mock_vector_ref = ref(null)
const mock_optimize = vi.fn()

// Mock dependencies
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    new_vector: mock_new_vector,
    new_gradients: mock_new_gradients,
    process_photo: mock_process_photo
  })
}))

vi.mock('@/use/optimize', () => ({
  use: vi.fn(vector => ({
    optimize: mock_optimize,
    vector: vector || mock_vector_ref
  }))
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
    it('is a function', () => {
      expect(processor.process_directory).toBeTypeOf('function')
    })
  })
})
