import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const { mock_converter } = vi.hoisted(() => ({
  mock_converter: {
    free: vi.fn(),
    init: vi.fn(),
    tick: vi.fn(),
    progress: vi.fn()
  }
}))

vi.mock('@/wasm/tracer.js', () => ({
  default: vi.fn(() => Promise.resolve()),
  initSync: vi.fn(),
  ColorImageConverter: {
    new_with_string: vi.fn(() => mock_converter)
  },
  init_panic_hook: vi.fn()
}))

// Set up mocks before importing the module
// Mock console.error to suppress expected initialization errors
vi.spyOn(console, 'error').mockImplementation((...args) => {
  // Suppress expected initialization error
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Failed to initialize converter')
  ) {
    return
  }
  // Suppress expected warnings during module load
  if (args[0] === 'unknown route undefined') {
    return
  }
})

// Mock console.warn to suppress expected warnings
vi.spyOn(console, 'warn').mockImplementation(() => {})

class MockResponse {
  constructor() {
    this.ok = true
    this.status = 200
  }
  async arrayBuffer() {
    return new ArrayBuffer(8)
  }
}

const mock_fetch = vi.fn(() => Promise.resolve(new MockResponse()))
global.fetch = mock_fetch

global.self = {
  postMessage: vi.fn(),
  addEventListener: vi.fn((event, handler) => {
    // Don't execute handlers automatically to avoid "unknown route undefined"
  })
}

import * as tracer from '@/workers/tracer'

describe('tracer worker', () => {
  let console_time_spy
  let console_timeEnd_spy
  let console_error_spy
  let console_warn_spy
  let postMessage_spy
  let setTimeout_spy

  beforeEach(() => {
    vi.clearAllMocks()
    console_time_spy = vi.spyOn(console, 'time').mockImplementation(() => {})
    console_timeEnd_spy = vi
      .spyOn(console, 'timeEnd')
      .mockImplementation(() => {})
    console_error_spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    postMessage_spy = vi
      .spyOn(global.self, 'postMessage')
      .mockImplementation(() => {})

    const timeout_callbacks = []
    let timeout_id = 1
    global.setTimeout = vi.fn((fn, delay) => {
      if (delay === 0) {
        timeout_callbacks.push(fn)
      }
      return timeout_id++
    })
    global.clearTimeout = vi.fn()
    global.flushTimeouts = () => {
      const callbacks = [...timeout_callbacks]
      timeout_callbacks.length = 0
      callbacks.forEach(fn => fn())
    }

    mock_fetch.mockResolvedValue(new MockResponse())

    mock_converter.tick.mockReturnValue(null)
    mock_converter.progress.mockReturnValue(0)

    // Reset event listener mocks
    global.self.addEventListener.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('make_trace', () => {
    it('validates image data size', () => {
      const invalid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100)
      }

      const message = { data: { image_data: invalid_image_data } }

      expect(() => tracer.make_trace(message)).toThrow(
        'Invalid image data size'
      )
    })

    it('initializes converter with valid image data', () => {
      const valid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4)
      }

      const message = { data: { image_data: valid_image_data } }
      tracer.make_trace(message)

      expect(mock_converter.init).toHaveBeenCalledWith(valid_image_data)
    })

    it('posts complete message when tracing finishes', async () => {
      const valid_image_data = {
        width: 200,
        height: 150,
        data: new Uint8ClampedArray(200 * 150 * 4)
      }

      mock_converter.tick.mockReturnValue('complete')
      mock_converter.progress.mockReturnValue(100)

      const message = { data: { image_data: valid_image_data } }
      tracer.make_trace(message)

      global.flushTimeouts()

      expect(postMessage_spy).toHaveBeenCalledWith({
        type: 'complete',
        width: 200,
        height: 150
      })
      expect(mock_converter.free).toHaveBeenCalled()
    })

    it('posts path message when path is generated', async () => {
      const valid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4)
      }

      const mock_path_data = { d: 'M0 0 L100 100' }
      mock_converter.tick
        .mockReturnValueOnce(JSON.stringify(mock_path_data))
        .mockReturnValue('complete')
      mock_converter.progress.mockReturnValue(50)

      const message = { data: { image_data: valid_image_data } }
      tracer.make_trace(message)

      global.flushTimeouts()

      expect(postMessage_spy).toHaveBeenCalledWith({
        type: 'path',
        path: mock_path_data,
        progress: 50
      })
    })

    it('posts progress message when progress changes', async () => {
      const valid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4)
      }

      mock_converter.tick
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(null)
        .mockReturnValue('complete')
      mock_converter.progress.mockReturnValue(25)

      const message = { data: { image_data: valid_image_data } }
      tracer.make_trace(message)

      global.flushTimeouts()

      expect(postMessage_spy).toHaveBeenCalledWith({
        type: 'progress',
        progress: 25
      })
    })

    it('handles processing errors', async () => {
      const valid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4)
      }

      const error = new Error('Processing failed')
      mock_converter.tick.mockImplementation(() => {
        throw error
      })

      const message = { data: { image_data: valid_image_data } }
      tracer.make_trace(message)

      global.flushTimeouts()

      expect(console_error_spy).toHaveBeenCalledWith(
        'Error in processing loop:',
        error
      )
      expect(postMessage_spy).toHaveBeenCalledWith({
        type: 'error',
        error: 'Processing failed'
      })
    })
  })

  describe('route_message', () => {
    it('routes make:trace message', async () => {
      const valid_image_data = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4)
      }

      mock_converter.tick.mockReturnValue('complete')
      mock_converter.progress.mockReturnValue(100)

      const message = {
        data: { route: 'make:trace', image_data: valid_image_data }
      }
      const result = await tracer.route_message(message)

      expect(result).toEqual({})
    })

    it('handles unknown route', async () => {
      const message = { data: { route: 'unknown:route' } }
      const result = await tracer.route_message(message)

      expect(console_warn_spy).toHaveBeenCalledWith(
        'unknown route',
        'unknown:route'
      )
      expect(result).toEqual({})
    })
  })
})
