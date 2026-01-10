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

import {
  use,
  resize_image,
  make_path,
  make_cutout_path,
  clone_tracer_path,
  sort_cutouts_into_layers,
  resize_to_blob,
  save_poster
} from '@/use/vectorize'

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
  }),
  as_query_id: vi.fn(id => id.replace(/\//g, '-')),
  as_layer_id: vi.fn((poster_id, layer) => {
    if (!poster_id || typeof poster_id !== 'string') return ''
    const parts = poster_id.split('/')
    const author = parts[1]
    const created = parts[3]
    if (!author || !created) return ''
    return `/${author}/${layer}/${created}`
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

vi.mock('@/persistance/Queue', () => ({
  add: vi.fn().mockResolvedValue(undefined),
  get_all: vi.fn().mockResolvedValue([]),
  get_next: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/algorithms', () => ({
  mutex: {
    lock: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn()
  }
}))

const mock_poster_constructor = vi.fn()
const mock_shadow_constructor = vi.fn()
const mock_cutout_constructor = vi.fn()

vi.mock('@/persistance/Storage', () => ({
  Poster: class {
    constructor(id) {
      mock_poster_constructor(id)
      this.id = id
    }
    async save() {
      return Promise.resolve()
    }
  },
  Shadow: class {
    constructor(id) {
      mock_shadow_constructor(id)
      this.id = id
    }
    async save() {
      return Promise.resolve()
    }
  },
  Cutout: class {
    constructor(id) {
      mock_cutout_constructor(id)
      this.id = id
    }
    async save() {
      return Promise.resolve()
    }
  }
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
let global_offscreen_canvas_mock = null
global.OffscreenCanvas = class {
  constructor(width, height) {
    this.width = width
    this.height = height
  }
  getContext() {
    if (global_offscreen_canvas_mock) {
      return global_offscreen_canvas_mock
    }
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(512 * 512 * 4),
        width: 512,
        height: 512
      })),
      putImageData: vi.fn()
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
    let mock_worker_factory
    let original_worker

    beforeEach(() => {
      original_worker = global.Worker
      mock_worker_factory = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
        removeEventListener: vi.fn()
      }))
      global.Worker = mock_worker_factory
    })

    afterEach(() => {
      global.Worker = original_worker
      vectorize_instance.vectorizer.value = null
      vectorize_instance.gradienter.value = null
      vectorize_instance.tracer.value = null
    })

    it('mount_workers creates worker instances', () => {
      vectorize_instance.mount_workers()

      expect(global.Worker).toHaveBeenCalledTimes(4)
      expect(global.Worker).toHaveBeenCalledWith('/vector.worker.js')
      expect(global.Worker).toHaveBeenCalledWith('/tracer.worker.js')
    })

    it('mount_workers does not create workers if already mounted', () => {
      vectorize_instance.mount_workers()
      const first_vectorizer = vectorize_instance.vectorizer.value
      const first_gradienter = vectorize_instance.gradienter.value
      const call_count = mock_worker_factory.mock.calls.length

      vectorize_instance.mount_workers()

      expect(vectorize_instance.vectorizer.value).toBe(first_vectorizer)
      expect(vectorize_instance.gradienter.value).toBe(first_gradienter)
      expect(mock_worker_factory.mock.calls.length).toBe(call_count)
    })

    it('mount_workers cleans up existing workers before creating new ones', () => {
      const existing_worker = {
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
        removeEventListener: vi.fn()
      }

      vectorize_instance.vectorizer.value = existing_worker
      vectorize_instance.gradienter.value = existing_worker
      vectorize_instance.tracer.value = existing_worker

      const terminate_spy = vi.spyOn(existing_worker, 'terminate')
      const remove_listener_spy = vi.spyOn(
        existing_worker,
        'removeEventListener'
      )

      vectorize_instance.mount_workers()

      expect(terminate_spy).toHaveBeenCalled()
      expect(remove_listener_spy).toHaveBeenCalled()
      expect(mock_worker_factory).toHaveBeenCalled()
    })

    it('mount_workers adds event listeners to workers', () => {
      vectorize_instance.mount_workers()

      expect(
        vectorize_instance.vectorizer.value.addEventListener
      ).toHaveBeenCalledWith('message', expect.any(Function))
      expect(
        vectorize_instance.gradienter.value.addEventListener
      ).toHaveBeenCalledWith('message', expect.any(Function))
      expect(
        vectorize_instance.tracer.value.addEventListener
      ).toHaveBeenCalledWith('message', expect.any(Function))
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
      if (original_offscreen_canvas) {
        global.OffscreenCanvas = original_offscreen_canvas
      }
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
    let Queue
    let mock_convert_to_blob
    let mock_get_image_data

    beforeEach(async () => {
      const queue_module = await import('@/persistance/Queue')
      Queue = queue_module
      vi.clearAllMocks()
      localStorage.me = '/user'
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
        removeEventListener: vi.fn()
      }))

      mock_get_image_data = vi.fn((x, y, width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
      }))

      mock_convert_to_blob = vi.fn(() =>
        Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
      )

      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
          this.convertToBlob = mock_convert_to_blob
        }
        getContext(type) {
          if (type === '2d') {
            return {
              drawImage: vi.fn(),
              getImageData: mock_get_image_data,
              putImageData: vi.fn()
            }
          }
          return {
            drawImage: vi.fn(),
            getImageData: mock_get_image_data
          }
        }
      }

      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: vi.fn()
        })
      )
    })

    it('adds files to queue', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1000 })

      await vectorize_instance.add_to_queue([file])

      expect(Queue.add).toHaveBeenCalled()
      expect(vectorize_instance.queue_items.value.length).toBeGreaterThan(0)
    })

    it('mounts workers when adding to queue', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1000 })

      await vectorize_instance.add_to_queue([file])

      expect(vectorize_instance.vectorizer.value).toBeInstanceOf(Object)
    })

    it('skips files larger than 200MB', async () => {
      const large_file = new File(['test'], 'large.jpg', { type: 'image/jpeg' })
      const max_size = 200 * 1024 * 1024
      Object.defineProperty(large_file, 'size', { value: max_size + 1 })

      const console_error = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      await vectorize_instance.add_to_queue([large_file])

      expect(Queue.add).not.toHaveBeenCalled()
      expect(console_error).toHaveBeenCalled()

      console_error.mockRestore()
    })

    it('adds items to queue_items computed', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1000 })

      await vectorize_instance.add_to_queue([file])

      expect(vectorize_instance.queue_items.value.length).toBeGreaterThan(0)
    })
  })

  describe('init_processing_queue', () => {
    it('init_processing_queue is a function', () => {
      expect(vectorize_instance.init_processing_queue).toBeTypeOf('function')
    })
  })

  describe('make_path', () => {
    it('creates SVG path element with path data', () => {
      const path_data = { d: 'M 0 0 L 100 100' }
      const path = make_path(path_data)

      expect(path.getAttribute('d')).toBe('M 0 0 L 100 100')
      expect(path.style.fillRule).toBe('evenodd')
    })

    it('handles empty path data', () => {
      const path_data = { d: '' }
      const path = make_path(path_data)

      expect(path.getAttribute('d')).toBe('')
    })
  })

  describe('make_cutout_path', () => {
    it('creates cutout path with all attributes', () => {
      const path_data = {
        d: 'M 0 0 L 50 50',
        color: { r: 255, g: 0, b: 0 },
        offset: { x: 10, y: 20 },
        progress: 75
      }

      const path = make_cutout_path(path_data)

      expect(path.getAttribute('d')).toBe('M 0 0 L 50 50')
      expect(path.getAttribute('fill-opacity')).toBe('0.5')
      expect(path.getAttribute('data-progress')).toBe('75')
      expect(path.dataset.transform).toBe('true')
      expect(path.getAttribute('fill')).toBe('rgb(255, 0, 0)')
      expect(path.getAttribute('transform')).toBe('translate(10, 20)')
    })

    it('handles zero progress', () => {
      const path_data = {
        d: 'M 0 0',
        color: { r: 0, g: 0, b: 0 },
        offset: { x: 0, y: 0 },
        progress: 0
      }

      const path = make_cutout_path(path_data)
      expect(path.getAttribute('data-progress')).toBe('0')
    })
  })

  describe('clone_tracer_path', () => {
    it('deep clones path data with nested objects', () => {
      const original = {
        d: 'M 0 0',
        color: { r: 255, g: 0, b: 0 },
        offset: { x: 10, y: 20 }
      }

      const cloned = clone_tracer_path(original)

      expect(cloned).not.toBe(original)
      expect(cloned.color).not.toBe(original.color)
      expect(cloned.offset).not.toBe(original.offset)
      expect(cloned).toEqual(original)
    })

    it('modifying clone does not affect original', () => {
      const original = {
        d: 'M 0 0',
        color: { r: 255, g: 0, b: 0 },
        offset: { x: 10, y: 20 }
      }

      const cloned = clone_tracer_path(original)
      cloned.color.r = 0
      cloned.offset.x = 999

      expect(original.color.r).toBe(255)
      expect(original.offset.x).toBe(10)
    })
  })

  describe('resize_image edge cases', () => {
    let mock_get_image_data
    let original_offscreen_canvas

    beforeEach(() => {
      original_offscreen_canvas = global.OffscreenCanvas

      mock_get_image_data = vi.fn((x, y, width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
      }))

      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
        }
        getContext() {
          return {
            drawImage: vi.fn(),
            getImageData: mock_get_image_data
          }
        }
      }
    })

    afterEach(() => {
      global.OffscreenCanvas = original_offscreen_canvas
    })

    it('handles very small images', () => {
      const mock_image = {
        width: 10,
        height: 10
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(512)
      expect(image_data.height).toBe(512)
    })

    it('handles very large images', () => {
      const mock_image = {
        width: 10000,
        height: 5000
      }

      const image_data = resize_image(mock_image, 512)

      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 1024, 512)
      expect(image_data.height).toBe(512)
      expect(image_data.width).toBe(1024)
    })

    it('handles custom target size', () => {
      const mock_image = {
        width: 2000,
        height: 1000
      }

      const image_data = resize_image(mock_image, 256)

      expect(mock_get_image_data).toHaveBeenCalledWith(0, 0, 512, 256)
      expect(image_data.height).toBe(256)
      expect(image_data.width).toBe(512)
    })

    it('handles images where width equals height exactly', () => {
      const mock_image = {
        width: 1500,
        height: 1500
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(512)
      expect(image_data.height).toBe(512)
    })
  })

  describe('sort_cutouts_into_layers', () => {
    it('sorts cutouts by progress into correct layers', () => {
      const mock_cutout1 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout1.setAttribute('data-progress', '50')
      const mock_cutout2 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout2.setAttribute('data-progress', '65')
      const mock_cutout3 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout3.setAttribute('data-progress', '75')
      const mock_cutout4 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout4.setAttribute('data-progress', '85')
      const mock_cutout5 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout5.setAttribute('data-progress', '95')

      const vector = {
        width: 100,
        height: 100,
        cutout: [
          mock_cutout1,
          mock_cutout2,
          mock_cutout3,
          mock_cutout4,
          mock_cutout5
        ]
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment.tagName).toBe('symbol')
      expect(result.sand.tagName).toBe('symbol')
      expect(result.gravel.tagName).toBe('symbol')
      expect(result.rock.tagName).toBe('symbol')
      expect(result.boulder.tagName).toBe('symbol')
    })

    it('handles empty cutout array', () => {
      const vector = {
        width: 100,
        height: 100,
        cutout: []
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment).toEqual([])
      expect(result.sand).toEqual([])
      expect(result.gravel).toEqual([])
      expect(result.rock).toEqual([])
      expect(result.boulder).toEqual([])
    })

    it('handles cutouts with missing progress attribute', () => {
      const mock_cutout = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )

      const vector = {
        width: 100,
        height: 100,
        cutout: [mock_cutout]
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment.tagName).toBe('symbol')
    })

    it('removes itemprop and tabindex attributes', () => {
      const mock_cutout = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout.setAttribute('itemprop', 'test')
      mock_cutout.setAttribute('tabindex', '0')
      mock_cutout.setAttribute('data-progress', '50')

      const vector = {
        width: 100,
        height: 100,
        cutout: [mock_cutout]
      }

      sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(mock_cutout.getAttribute('itemprop')).toBe(null)
      expect(mock_cutout.getAttribute('tabindex')).toBe(null)
    })

    it('creates symbol with correct attributes', () => {
      const mock_cutout = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      mock_cutout.setAttribute('data-progress', '50')

      const vector = {
        width: 200,
        height: 300,
        cutout: [mock_cutout]
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment.getAttribute('viewBox')).toBe('0 0 200 300')
      expect(result.sediment.getAttribute('itemtype')).toBe('/cutouts')
      expect(result.sediment.getAttribute('itemscope')).toBe('')
    })

    it('handles boundary values for progress', () => {
      const cutout_59 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_59.setAttribute('data-progress', '59')
      const cutout_60 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_60.setAttribute('data-progress', '60')
      const cutout_69 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_69.setAttribute('data-progress', '69')
      const cutout_70 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_70.setAttribute('data-progress', '70')
      const cutout_79 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_79.setAttribute('data-progress', '79')
      const cutout_80 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_80.setAttribute('data-progress', '80')
      const cutout_89 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_89.setAttribute('data-progress', '89')
      const cutout_90 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_90.setAttribute('data-progress', '90')

      const vector = {
        width: 100,
        height: 100,
        cutout: [
          cutout_59,
          cutout_60,
          cutout_69,
          cutout_70,
          cutout_79,
          cutout_80,
          cutout_89,
          cutout_90
        ]
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment.querySelector('path')).toBe(cutout_59)
      expect(result.sand.querySelector('path')).toBe(cutout_60)
      expect(result.gravel.querySelector('path')).toBe(cutout_70)
      expect(result.rock.querySelector('path')).toBe(cutout_80)
      expect(result.boulder.querySelector('path')).toBe(cutout_90)
    })
  })

  describe('resize_to_blob', () => {
    let mock_get_image_data
    let mock_convert_to_blob
    let original_offscreen_canvas
    let original_create_image_bitmap

    beforeEach(() => {
      original_offscreen_canvas = global.OffscreenCanvas
      original_create_image_bitmap = global.createImageBitmap

      mock_get_image_data = vi.fn((x, y, width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height
      }))

      mock_convert_to_blob = vi.fn(() =>
        Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
      )

      const mock_context_2d = {
        drawImage: vi.fn(),
        getImageData: mock_get_image_data,
        putImageData: vi.fn()
      }

      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
          this.convertToBlob = mock_convert_to_blob
        }
        getContext(type) {
          if (type === '2d') {
            return {
              ...mock_context_2d,
              putImageData: vi.fn()
            }
          }
          return {
            ...mock_context_2d,
            getImageData: mock_get_image_data
          }
        }
      }

      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: vi.fn()
        })
      )

      global.Image = class {
        constructor() {
          this.src = ''
          setTimeout(() => this.onload && this.onload(), 0)
        }
      }
    })

    afterEach(() => {
      global.OffscreenCanvas = original_offscreen_canvas
      global.createImageBitmap = original_create_image_bitmap
    })

    it('resizes regular image file to blob', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
      expect(global.createImageBitmap).toHaveBeenCalledWith(file)
    })

    it('handles TIFF files with image fallback', async () => {
      const file = new File([''], 'test.tiff', { type: 'image/tiff' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
      expect(global.createImageBitmap).toHaveBeenCalled()
    })

    it('handles BMP files with image fallback', async () => {
      const file = new File([''], 'test.bmp', { type: 'image/bmp' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
    })

    it('handles AVIF files with image fallback', async () => {
      const file = new File([''], 'test.avif', { type: 'image/avif' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
    })

    it('handles files with lowercase extensions', async () => {
      const file = new File([''], 'test.tif', { type: 'image/tiff' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
    })

    it('returns blob with correct type and quality', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      await resize_to_blob(file)

      expect(mock_convert_to_blob).toHaveBeenCalledWith({
        type: 'image/jpeg',
        quality: 0.7
      })
    })

    it('closes bitmap after processing', async () => {
      const close_spy = vi.fn()
      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: close_spy
        })
      )

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      await resize_to_blob(file)

      expect(close_spy).toHaveBeenCalled()
    })

    it('handles createImageBitmap errors for regular files', async () => {
      global.createImageBitmap = vi.fn(() =>
        Promise.reject(new Error('File too large'))
      )

      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      await expect(resize_to_blob(file)).rejects.toThrow('File too large')
    })
  })

  describe('save_poster', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('saves shadow and all cutout layers', async () => {
      const id = '/user/posters/1234567890'

      await save_poster(id)

      expect(mock_shadow_constructor).toHaveBeenCalledWith(
        '/user/shadows/1234567890'
      )
      expect(mock_cutout_constructor).toHaveBeenCalledWith(
        '/user/sediment/1234567890'
      )
      expect(mock_cutout_constructor).toHaveBeenCalledWith(
        '/user/sand/1234567890'
      )
      expect(mock_cutout_constructor).toHaveBeenCalledWith(
        '/user/gravel/1234567890'
      )
      expect(mock_cutout_constructor).toHaveBeenCalledWith(
        '/user/rocks/1234567890'
      )
      expect(mock_cutout_constructor).toHaveBeenCalledWith(
        '/user/boulders/1234567890'
      )
    })

    it('saves poster after cutouts', async () => {
      const id = '/user/posters/1234567890'

      await save_poster(id)

      expect(mock_poster_constructor).toHaveBeenCalledWith(id)
    })

    it('saves all items in parallel', async () => {
      const id = '/user/posters/1234567890'
      const save_calls = []

      const storage_module = await import('@/persistance/Storage')
      const Poster = storage_module.Poster
      const Shadow = storage_module.Shadow
      const Cutout = storage_module.Cutout

      vi.spyOn(Poster.prototype, 'save').mockImplementation(async () => {
        save_calls.push('poster')
        return Promise.resolve()
      })
      vi.spyOn(Shadow.prototype, 'save').mockImplementation(async () => {
        save_calls.push('shadow')
        return Promise.resolve()
      })
      vi.spyOn(Cutout.prototype, 'save').mockImplementation(async () => {
        save_calls.push('cutout')
        return Promise.resolve()
      })

      await save_poster(id)

      expect(save_calls.length).toBe(7)
      expect(save_calls.filter(c => c === 'cutout').length).toBe(5)
      expect(save_calls).toContain('shadow')
      expect(save_calls).toContain('poster')
    })
  })

  describe('cleanup_queue_item', () => {
    it('removes resized_blob from queue item', () => {
      const item = {
        id: '/user/posters/123',
        resized_blob: new Blob(['test'])
      }

      vectorize_instance.cleanup_queue_item(item)

      expect(item.resized_blob).toBe(null)
    })

    it('handles item without resized_blob', () => {
      const item = {
        id: '/user/posters/123'
      }

      vectorize_instance.cleanup_queue_item(item)

      expect(item.resized_blob).toBeUndefined()
    })

    it('handles null item', () => {
      vectorize_instance.cleanup_queue_item(null)
    })

    it('handles undefined item', () => {
      vectorize_instance.cleanup_queue_item(undefined)
    })
  })
})
