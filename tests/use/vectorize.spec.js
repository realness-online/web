import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const image_picker_ref = ref({
  files: [],
  value: '',
  click: vi.fn(),
  setAttribute: vi.fn(),
  removeAttribute: vi.fn()
})

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
  as_path_parts: vi.fn(id => {
    if (!id || typeof id !== 'string') return []
    const path = id.split('/')
    if (path[0].length === 0) path.shift()
    return path
  }),
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
    async optimize() {
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

vi.mock('@/utils/item', () => ({
  default: vi.fn((html, id) => ({
    light: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    regular: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    medium: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    bold: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    cutout: []
  }))
}))

const localStorageMock = {
  me: '/+14151234356'
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()
global.Image = class {
  constructor() {
    this._src = ''
    this._onload = null
    this._onerror = null
    this.width = 1000
    this.height = 1000
  }
  set src(value) {
    this._src = value
    if (value && this._onload) {
      const result = this._onload()
      if (result && typeof result.then === 'function') {
        result.catch(() => {})
      }
    }
  }
  get src() {
    return this._src || ''
  }
  set onload(handler) {
    this._onload = handler
    if (this._src && handler) {
      const result = this._onload()
      if (result && typeof result.then === 'function') {
        result.catch(() => {})
      }
    }
  }
  get onload() {
    return this._onload
  }
  set onerror(handler) {
    this._onerror = handler
  }
  get onerror() {
    return this._onerror
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
      })),
      putImageData: vi.fn()
    }
  }
}

function with_setup(composable) {
  let result
  const app = defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  })
  const wrapper = mount(app)
  return { instance: result, wrapper }
}

describe('vectorize composable', () => {
  let vectorize_instance

  beforeEach(async () => {
    vi.clearAllMocks()

    const Queue = await import('@/persistance/Queue')
    Queue.get_all.mockResolvedValue([])
    Queue.get_next.mockResolvedValue(null)

    image_picker_ref.value = {
      files: [],
      value: '',
      click: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn()
    }

    const result = with_setup(() => use())
    vectorize_instance = result.instance
  })

  afterEach(() => {
    if (vectorize_instance) {
      vectorize_instance.working.value = false
      if (vectorize_instance.vectorizer)
        vectorize_instance.vectorizer.value = null
      if (vectorize_instance.gradienter)
        vectorize_instance.gradienter.value = null
      if (vectorize_instance.tracer) vectorize_instance.tracer.value = null
      vectorize_instance.reset?.()
    }
    localStorage.me = '/+14151234356'
    vi.clearAllMocks()
  })

  describe('camera functions', () => {
    it('select_photo removes capture attribute and clicks picker', () => {
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

    it('open_selfie_camera sets capture to user and clicks picker', () => {
      const mock_picker = {
        setAttribute: vi.fn(),
        click: vi.fn()
      }
      vectorize_instance.image_picker.value = mock_picker

      vectorize_instance.open_selfie_camera()

      expect(mock_picker.setAttribute).toHaveBeenCalledWith('capture', 'user')
      expect(mock_picker.click).toHaveBeenCalled()
    })

    it('open_camera sets capture to environment and clicks picker', () => {
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

  describe('vectorize', () => {
    beforeEach(() => {
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn()
      }))
      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: vi.fn()
        })
      )
      vectorize_instance.mount_workers()
    })

    it('processes image file', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      await vectorize_instance.vectorize(file)

      expect(vectorize_instance.vectorizer.value.postMessage).toHaveBeenCalled()
    })

    it('handles SVG files', async () => {
      const svg_content = '<svg><rect width="100" height="100"/></svg>'
      const file = new File([svg_content], 'test.svg', {
        type: 'image/svg+xml'
      })

      await vectorize_instance.vectorize(file)

      expect(vectorize_instance.vectorizer.value.postMessage).toHaveBeenCalled()
    })
  })

  describe('add_to_queue', () => {
    beforeEach(async () => {
      global.Worker = vi.fn(() => ({
        addEventListener: vi.fn(),
        postMessage: vi.fn(),
        terminate: vi.fn(),
        removeEventListener: vi.fn()
      }))
      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: vi.fn()
        })
      )
      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
          this.convertToBlob = vi.fn(() =>
            Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
          )
        }
        getContext() {
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
      localStorage.me = '/user'
    })

    it('adds files to queue', async () => {
      const Queue = await import('@/persistance/Queue')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1000 })

      await vectorize_instance.add_to_queue([file])

      expect(Queue.add).toHaveBeenCalled()
    })

    it('skips files larger than 200MB', async () => {
      const Queue = await import('@/persistance/Queue')
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
  })

  describe('reset', () => {
    it('resets all state', () => {
      vectorize_instance.source_image_url.value = 'blob:test-url'
      vectorize_instance.new_vector.value = {
        light: document.createElementNS('http://www.w3.org/2000/svg', 'path')
      }
      vectorize_instance.new_gradients.value = [{ color: 'red' }]
      vectorize_instance.progress.value = 50

      vectorize_instance.reset()

      expect(vectorize_instance.new_vector.value).toBe(null)
      expect(vectorize_instance.new_gradients.value).toBe(null)
      expect(vectorize_instance.progress.value).toBe(0)
      expect(vectorize_instance.source_image_url.value).toBe(null)
    })
  })
})

describe('exported utilities', () => {
  describe('make_path', () => {
    it('creates SVG path element with path data', () => {
      const path_data = { d: 'M 0 0 L 100 100' }
      const path = make_path(path_data)

      expect(path.getAttribute('d')).toBe('M 0 0 L 100 100')
      expect(path.style.fillRule).toBe('evenodd')
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
      expect(path.getAttribute('fill')).toBe('rgb(255, 0, 0)')
      expect(path.getAttribute('transform')).toBe('translate(10, 20)')
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
  })

  describe('resize_image', () => {
    let mock_get_image_data

    beforeEach(() => {
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

    it('resizes landscape image correctly', () => {
      const mock_image = {
        width: 2000,
        height: 1000
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(1024)
      expect(image_data.height).toBe(512)
    })

    it('resizes portrait image correctly', () => {
      const mock_image = {
        width: 1000,
        height: 2000
      }

      const image_data = resize_image(mock_image, 512)

      expect(image_data.width).toBe(512)
      expect(image_data.height).toBe(1024)
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

  describe('resize_to_blob', () => {
    let mock_convert_to_blob

    beforeEach(() => {
      mock_convert_to_blob = vi.fn(() =>
        Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))
      )

      global.OffscreenCanvas = class {
        constructor(width, height) {
          this.width = width
          this.height = height
          this.convertToBlob = mock_convert_to_blob
        }
        getContext() {
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

      global.createImageBitmap = vi.fn(() =>
        Promise.resolve({
          width: 1000,
          height: 1000,
          close: vi.fn()
        })
      )
    })

    it('resizes regular image file to blob', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })

      const result = await resize_to_blob(file)

      expect(result.blob).toBeInstanceOf(Blob)
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
    })
  })

  describe('sort_cutouts_into_layers', () => {
    it('sorts cutouts by progress into correct layers', () => {
      const cutout_50 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_50.setAttribute('data-progress', '50')
      const cutout_65 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_65.setAttribute('data-progress', '65')
      const cutout_75 = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      cutout_75.setAttribute('data-progress', '75')

      const vector = {
        width: 100,
        height: 100,
        cutout: [cutout_50, cutout_65, cutout_75]
      }

      const result = sort_cutouts_into_layers(vector, '/user/posters/123')

      expect(result.sediment.tagName).toBe('symbol')
      expect(result.sand.tagName).toBe('symbol')
      expect(result.gravel.tagName).toBe('symbol')
    })
  })

  describe('save_poster', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      const mock_element = document.createElement('svg')
      mock_element.setAttribute('itemid', '/user/posters/1234567890')
      vi.spyOn(document, 'querySelector').mockReturnValue(mock_element)
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
    })
  })
})
