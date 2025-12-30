import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

// Create image_picker ref before any imports
const image_picker_ref = ref({
  files: [],
  value: '',
  click: vi.fn(),
  setAttribute: vi.fn(),
  removeAttribute: vi.fn()
})

// Mock Vue inject before importing use
vi.mock('vue', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    inject: vi.fn((key, defaultValue) => {
      if (key === 'image-picker') return image_picker_ref
      return defaultValue
    })
  }
})

import { use, resize_image } from '@/use/vectorize'

// Mock dependencies
vi.mock('@/use/path', () => ({
  create_path_element: vi.fn(() => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    return path
  })
}))

vi.mock('@/use/poster', () => ({
  is_vector: vi.fn(vector => {
    return (
      vector && vector.light && vector.regular && vector.medium && vector.bold
    )
  })
}))

vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(id => {
    const parts = id.split('/')
    return parts[parts.length - 1]
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

vi.mock('@/utils/numbers', () => ({
  to_kb: vi.fn(obj => Math.round(JSON.stringify(obj).length / 1024)),
  IMAGE: {
    TARGET_SIZE: 512
  }
}))

vi.mock('exifreader', () => ({
  default: {
    load: vi.fn(() =>
      Promise.resolve({
        expanded: true,
        gps: { Latitude: 37.7749, Longitude: -122.4194 }
      })
    )
  }
}))

// Mock localStorage
const localStorageMock = {
  me: '/+14151234356'
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Mock global functions
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
global.Image = class {
  constructor() {
    this.src = ''
    setTimeout(() => this.onload && this.onload(), 0)
  }
}
global.createImageBitmap = vi.fn(() =>
  Promise.resolve({ width: 1000, height: 1000, close: vi.fn() })
)
global.OffscreenCanvas = class {
  constructor(width, height) {
    this.width = width
    this.height = height
  }
  getContext() {
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(512 * 512 * 4),
        width: 512,
        height: 512
      }))
    }
  }
}

// Helper to test composables in proper Vue context
function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  mount(app)
  return result
}

describe('vectorize composable', () => {
  let vectorize_instance

  beforeEach(() => {
    vi.clearAllMocks()
    image_picker_ref.value = {
      files: [],
      value: '',
      click: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn()
    }

    vectorize_instance = with_setup(() => use())
  })

  describe('initialization', () => {
    it('returns composable functions', () => {
      expect(vectorize_instance.select_photo).toBeTypeOf('function')
      expect(vectorize_instance.open_selfie_camera).toBeTypeOf('function')
      expect(vectorize_instance.open_camera).toBeTypeOf('function')
      expect(vectorize_instance.vectorize).toBeTypeOf('function')
      expect(vectorize_instance.mount_workers).toBeTypeOf('function')
    })

    it('initializes refs with correct values', () => {
      expect(vectorize_instance.working.value).toBe(false)
      expect(vectorize_instance.new_vector.value).toBe(null)
      expect(vectorize_instance.new_gradients.value).toBe(null)
      expect(vectorize_instance.progress.value).toBe(0)
    })

    it('can_add computed returns true initially', () => {
      expect(vectorize_instance.can_add.value).toBe(true)
    })
  })

  describe('camera functions', () => {
    it('select_photo removes capture attribute', () => {
      const mock_picker = {
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
        click: vi.fn()
      }
      vectorize_instance.image_picker.value = mock_picker

      vectorize_instance.select_photo()

      expect(mock_picker.removeAttribute).toHaveBeenCalledWith('capture')
      expect(mock_picker.click).toHaveBeenCalled()
    })

    it('open_selfie_camera sets capture to user', () => {
      const mock_picker = {
        setAttribute: vi.fn(),
        click: vi.fn()
      }
      vectorize_instance.image_picker.value = mock_picker

      vectorize_instance.open_selfie_camera()

      expect(mock_picker.setAttribute).toHaveBeenCalledWith('capture', 'user')
      expect(mock_picker.click).toHaveBeenCalled()
    })

    it('open_camera sets capture to environment', () => {
      const mock_picker = {
        setAttribute: vi.fn(),
        click: vi.fn()
      }
      vectorize_instance.image_picker.value = mock_picker

      vectorize_instance.open_camera()

      expect(mock_picker.setAttribute).toHaveBeenCalledWith(
        'capture',
        'environment'
      )
      expect(mock_picker.click).toHaveBeenCalled()
    })
  })

  describe('can_add computed', () => {
    it('returns false when working', () => {
      vectorize_instance.working.value = true
      expect(vectorize_instance.can_add.value).toBe(false)
    })

    it('returns false when new_vector exists', () => {
      vectorize_instance.new_vector.value = { id: 'test' }
      expect(vectorize_instance.can_add.value).toBe(false)
    })

    it('returns true when not working and no new_vector', () => {
      vectorize_instance.working.value = false
      vectorize_instance.new_vector.value = null
      expect(vectorize_instance.can_add.value).toBe(true)
    })
  })

  describe('vectorizer ref', () => {
    it('vectorizer ref is initially null', () => {
      expect(vectorize_instance.vectorizer.value).toBe(null)
    })

    it('vectorizer ref is set after mount_workers', () => {
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      }))

      vectorize_instance.mount_workers()
      expect(vectorize_instance.vectorizer.value).toBeDefined()
    })
  })

  describe('vVectorizer directive', () => {
    it('provides mounted hook', () => {
      expect(vectorize_instance.vVectorizer.mounted).toBeTypeOf('function')
    })

    it('mounted hook adds change listener', () => {
      const input = { addEventListener: vi.fn() }
      vectorize_instance.vVectorizer.mounted(input, {})

      expect(input.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
    })
  })

  describe('worker management', () => {
    it('mount_workers creates worker instances', () => {
      const originalWorker = global.Worker
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      }))

      vectorize_instance.mount_workers()

      expect(global.Worker).toHaveBeenCalledTimes(4)
      expect(global.Worker).toHaveBeenCalledWith('/vector.worker.js')
      expect(global.Worker).toHaveBeenCalledWith('/tracer.worker.js')

      global.Worker = originalWorker
    })
  })

  describe('vectorize function', () => {
    beforeEach(() => {
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      }))
      vectorize_instance.mount_workers()
    })

    it('sets working to true', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      const promise = vectorize_instance.vectorize(file)
      expect(vectorize_instance.working.value).toBe(true)
      await promise
    })

    it('resets progress to 0', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      vectorize_instance.progress.value = 50

      await vectorize_instance.vectorize(file)
      expect(vectorize_instance.progress.value).toBe(0)
    })

    it('calls vectorizer postMessage', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      await vectorize_instance.vectorize(file)

      expect(vectorize_instance.vectorizer.value.postMessage).toHaveBeenCalled()
    })

    it('handles SVG files differently', async () => {
      const svg_content = '<svg><rect width="100" height="100"/></svg>'
      const file = new File([svg_content], 'test.svg', {
        type: 'image/svg+xml'
      })

      await vectorize_instance.vectorize(file)

      expect(vectorize_instance.vectorizer.value.postMessage).toHaveBeenCalled()
    })
  })

  describe('progress tracking', () => {
    it('progress ref is reactive', () => {
      expect(vectorize_instance.progress.value).toBe(0)
      vectorize_instance.progress.value = 50
      expect(vectorize_instance.progress.value).toBe(50)
    })
  })

  describe('new_vector ref', () => {
    it('new_vector can be set', () => {
      const vector = { id: 'test', type: 'posters' }
      vectorize_instance.new_vector.value = vector
      expect(vectorize_instance.new_vector.value).toEqual(vector)
    })
  })

  describe('new_gradients ref', () => {
    it('new_gradients can be set', () => {
      const gradients = [{ color: 'red' }, { color: 'blue' }]
      vectorize_instance.new_gradients.value = gradients
      expect(vectorize_instance.new_gradients.value).toEqual(gradients)
    })
  })

  describe('resize_image', () => {
    let mock_get_image_data
    let original_offscreen_canvas
    let mock_context

    beforeEach(() => {
      original_offscreen_canvas = global.OffscreenCanvas

      mock_get_image_data = vi.fn((x, y, width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
      }))

      mock_context = {
        drawImage: vi.fn(),
        getImageData: mock_get_image_data
      }

      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
        }
        getContext() {
          return mock_context
        }
      }
    })

    afterEach(() => {
      global.OffscreenCanvas = original_offscreen_canvas
    })

    it('resizes landscape image correctly', () => {
      const mock_image = {
        width: 2000,
        height: 1000
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(1024)
      expect(image_data.height).toBe(512)
      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 1024, 512)
    })

    it('resizes portrait image correctly', () => {
      const mock_image = {
        width: 1000,
        height: 2000
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(512)
      expect(image_data.height).toBe(1024)
      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 512, 1024)
    })

    it('resizes square image correctly', () => {
      const mock_image = {
        width: 1000,
        height: 1000
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(512)
      expect(image_data.height).toBe(512)
      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 512, 512)
    })

    it('uses default target size when not provided', () => {
      const mock_image = {
        width: 1000,
        height: 500
      }

      const image_data = resize_image(mock_image)

      expect(image_data.height).toBe(512)
      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 1024, 512)
    })

    it('maintains aspect ratio', () => {
      const mock_image = {
        width: 4000,
        height: 2000
      }

      const image_data = resize_image(mock_image, 512)
      const aspect_ratio = image_data.width / image_data.height
      const original_aspect_ratio = mock_image.width / mock_image.height

      expect(aspect_ratio).toBeCloseTo(original_aspect_ratio, 2)
    })
  })

  describe('queue management', () => {
    it('queue_items computed returns current queue items', () => {
      expect(vectorize_instance.queue_items.value).toEqual([])
    })

    it('current_processing computed returns current processing item', () => {
      expect(vectorize_instance.current_processing.value).toBe(null)
    })

    it('is_processing computed returns processing state', () => {
      expect(vectorize_instance.is_processing.value).toBe(false)
    })

    it('completed_posters computed returns completed posters list', () => {
      expect(vectorize_instance.completed_posters.value).toEqual([])
    })
  })

  describe('add_to_queue', () => {
    beforeEach(() => {
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      }))
      vectorize_instance.mount_workers()
    })

    it('add_to_queue is a function', () => {
      expect(vectorize_instance.add_to_queue).toBeTypeOf('function')
    })
  })

  describe('init_processing_queue', () => {
    it('init_processing_queue is a function', () => {
      expect(vectorize_instance.init_processing_queue).toBeTypeOf('function')
    })
  })
})
