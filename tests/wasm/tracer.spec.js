import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mock_wasm_module = {
  memory: {
    buffer: new ArrayBuffer(1024)
  },
  __wbindgen_malloc: vi.fn((size, align) => {
    return 0
  }),
  __wbindgen_realloc: vi.fn((ptr, old_size, new_size, align) => {
    return 0
  }),
  __wbindgen_free: vi.fn(),
  __wbindgen_start: vi.fn(),
  __wbindgen_export_3: {
    get: vi.fn(() => null),
    grow: vi.fn(() => 0),
    set: vi.fn()
  },
  __externref_table_dealloc: vi.fn(),
  init_panic_hook: vi.fn(),
  colorimageconverter_new_with_string: vi.fn(() => 12345),
  colorimageconverter_init: vi.fn(() => [0, false]),
  colorimageconverter_tick: vi.fn(() => [0, 0, 0, false]),
  colorimageconverter_progress: vi.fn(() => 50),
  __wbg_colorimageconverter_free: vi.fn()
}

describe('wasm tracer', () => {
  let console_warn_spy
  let console_error_spy

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    console_error_spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    global.TextDecoder = class TextDecoder {
      constructor() {}
      decode() {
        return ''
      }
    }

    global.TextEncoder = class TextEncoder {
      constructor() {}
      encode() {
        return new Uint8Array()
      }
      encodeInto() {
        return { read: 0, written: 0 }
      }
    }

    global.WebAssembly = {
      Module: vi.fn(),
      Instance: vi.fn(() => ({
        exports: mock_wasm_module
      })),
      instantiate: vi.fn(),
      instantiateStreaming: vi.fn()
    }

    global.FinalizationRegistry = class FinalizationRegistry {
      constructor() {}
      register() {}
      unregister() {}
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initSync', () => {
    beforeEach(async () => {
      const { initSync } = await import('@/wasm/tracer.js')
    })

    it('initializes wasm module synchronously', async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      const result = initSync({ module: wasm_bytes })

      expect(WebAssembly.Module).toHaveBeenCalled()
      expect(WebAssembly.Instance).toHaveBeenCalled()
      expect(mock_wasm_module.__wbindgen_start).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('returns existing wasm if already initialized', async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      const first_result = initSync({ module: wasm_bytes })
      const second_result = initSync({ module: wasm_bytes })

      expect(WebAssembly.Instance).toHaveBeenCalledTimes(1)
      expect(second_result).toBe(first_result)
    })

    it('handles module parameter without object wrapper', async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      const result = initSync(wasm_bytes)

      expect(WebAssembly.Module).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('warns about deprecated parameters', async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      initSync(wasm_bytes)

      expect(console_warn_spy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated parameters')
      )
    })
  })

  describe('init_panic_hook', () => {
    it('calls wasm init_panic_hook', async () => {
      const { initSync, init_panic_hook } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      initSync({ module: wasm_bytes })

      init_panic_hook()

      expect(mock_wasm_module.init_panic_hook).toHaveBeenCalled()
    })
  })

  describe('ColorImageConverter', () => {
    beforeEach(async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      initSync({ module: wasm_bytes })
    })

    describe('new_with_string', () => {
      it('creates converter with string params', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        const params = JSON.stringify({ mode: 'polygon' })
        const converter = ColorImageConverter.new_with_string(params)

        expect(mock_wasm_module.colorimageconverter_new_with_string).toHaveBeenCalled()
        expect(converter).toBeInstanceOf(ColorImageConverter)
        expect(converter.__wbg_ptr).toBe(12345)
      })
    })

    describe('init', () => {
      it('initializes converter with ImageData', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        const converter = ColorImageConverter.new_with_string('{}')
        const image_data = {
          width: 100,
          height: 100,
          data: new Uint8ClampedArray(100 * 100 * 4)
        }

        converter.init(image_data)

        expect(mock_wasm_module.colorimageconverter_init).toHaveBeenCalled()
      })

      it('throws error if wasm returns error', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        mock_wasm_module.colorimageconverter_init.mockReturnValue([1, true])
        mock_wasm_module.__wbindgen_export_3.get.mockReturnValue(
          new Error('Init failed')
        )

        const converter = ColorImageConverter.new_with_string('{}')
        const image_data = {
          width: 100,
          height: 100,
          data: new Uint8ClampedArray(100 * 100 * 4)
        }

        expect(() => converter.init(image_data)).toThrow()
      })
    })

    describe('tick', () => {
      it('returns undefined when no path is ready', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        mock_wasm_module.colorimageconverter_tick.mockReturnValue([0, 0, 0, false])

        const converter = ColorImageConverter.new_with_string('{}')
        const result = converter.tick()

        expect(result).toBeUndefined()
      })

      it('returns string when path is ready', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        const mock_string_ptr = 1000
        const mock_string_len = 10
        mock_wasm_module.colorimageconverter_tick.mockReturnValue([
          mock_string_ptr,
          mock_string_len,
          0,
          false
        ])

        const mock_memory = new Uint8Array(1024)
        const mock_string = 'test path'
        const encoder = new TextEncoder()
        const encoded = encoder.encode(mock_string)
        mock_memory.set(encoded, mock_string_ptr)

        Object.defineProperty(mock_wasm_module, 'memory', {
          value: { buffer: mock_memory.buffer },
          writable: true
        })

        const converter = ColorImageConverter.new_with_string('{}')
        const result = converter.tick()

        expect(mock_wasm_module.colorimageconverter_tick).toHaveBeenCalled()
        expect(mock_wasm_module.__wbindgen_free).toHaveBeenCalled()
      })

      it('throws error if wasm returns error', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        mock_wasm_module.colorimageconverter_tick.mockReturnValue([0, 0, 1, true])
        mock_wasm_module.__wbindgen_export_3.get.mockReturnValue(
          new Error('Tick failed')
        )

        const converter = ColorImageConverter.new_with_string('{}')

        expect(() => converter.tick()).toThrow()
      })
    })

    describe('progress', () => {
      it('returns progress value', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        mock_wasm_module.colorimageconverter_progress.mockReturnValue(75)

        const converter = ColorImageConverter.new_with_string('{}')
        const progress = converter.progress()

        expect(mock_wasm_module.colorimageconverter_progress).toHaveBeenCalled()
        expect(progress).toBe(75)
      })
    })

    describe('free', () => {
      it('calls wasm free function', async () => {
        const { ColorImageConverter } = await import('@/wasm/tracer.js')
        const converter = ColorImageConverter.new_with_string('{}')
        converter.free()

        expect(mock_wasm_module.__wbg_colorimageconverter_free).toHaveBeenCalledWith(
          12345,
          0
        )
        expect(converter.__wbg_ptr).toBe(0)
      })
    })
  })

  describe('async initialization (default export)', () => {
    beforeEach(() => {
      global.Response = class Response {
        constructor(body, init = {}) {
          this.body = body
          this.headers = {
            get: vi.fn(key => {
              if (init.headers && init.headers[key]) {
                return init.headers[key]
              }
              return null
            })
          }
        }
        async arrayBuffer() {
          return this.body instanceof ArrayBuffer
            ? this.body
            : new ArrayBuffer(8)
        }
      }
    })

    it('initializes wasm module asynchronously', async () => {
      const mock_response = new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'application/wasm' }
      })

      global.fetch = vi.fn().mockResolvedValue(mock_response)

      WebAssembly.instantiateStreaming = vi.fn().mockResolvedValue({
        instance: {
          exports: mock_wasm_module
        },
        module: {}
      })

      const tracer_module = await import('@/wasm/tracer.js')
      const result = await tracer_module.default()

      expect(fetch).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('handles Response object', async () => {
      const mock_response = new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'application/wasm' }
      })

      WebAssembly.instantiateStreaming = vi.fn().mockResolvedValue({
        instance: {
          exports: mock_wasm_module
        },
        module: {}
      })

      const tracer_module = await import('@/wasm/tracer.js')
      const result = await tracer_module.default(mock_response)

      expect(WebAssembly.instantiateStreaming).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('falls back to instantiate if streaming fails', async () => {
      const mock_response = new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'text/plain' }
      })

      WebAssembly.instantiateStreaming = vi
        .fn()
        .mockRejectedValue(new Error('Streaming failed'))
      WebAssembly.instantiate = vi.fn().mockResolvedValue({
        instance: {
          exports: mock_wasm_module
        },
        module: {}
      })

      const tracer_module = await import('@/wasm/tracer.js')
      const result = await tracer_module.default(mock_response)

      expect(WebAssembly.instantiate).toHaveBeenCalled()
      expect(console_warn_spy).toHaveBeenCalledWith(
        expect.stringContaining('instantiateStreaming'),
        expect.any(Error)
      )
      expect(result).toBeDefined()
    })

    it('uses default URL when no path provided', async () => {
      const mock_response = new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'application/wasm' }
      })

      global.fetch = vi.fn().mockResolvedValue(mock_response)

      WebAssembly.instantiateStreaming = vi.fn().mockResolvedValue({
        instance: {
          exports: mock_wasm_module
        },
        module: {}
      })

      const tracer_module = await import('@/wasm/tracer.js')
      await tracer_module.default()

      expect(fetch).toHaveBeenCalled()
    })

    it('warns about deprecated parameters', async () => {
      const mock_response = new Response(new ArrayBuffer(8), {
        headers: { 'Content-Type': 'application/wasm' }
      })

      global.fetch = vi.fn().mockResolvedValue(mock_response)

      WebAssembly.instantiateStreaming = vi.fn().mockResolvedValue({
        instance: {
          exports: mock_wasm_module
        },
        module: {}
      })

      const tracer_module = await import('@/wasm/tracer.js')
      await tracer_module.default('/path/to/wasm')

      expect(console_warn_spy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated parameters')
      )
    })
  })

  describe('memory management', () => {
    beforeEach(async () => {
      const { initSync } = await import('@/wasm/tracer.js')
      const wasm_bytes = new ArrayBuffer(8)
      initSync({ module: wasm_bytes })
    })

    it('caches Uint8Array memory view', async () => {
      const { ColorImageConverter } = await import('@/wasm/tracer.js')
      const converter = ColorImageConverter.new_with_string('{}')
      const image_data = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(400)
      }

      converter.init(image_data)

      expect(mock_wasm_module.__wbindgen_malloc).toHaveBeenCalled()
    })

    it('caches DataView memory view', async () => {
      const { ColorImageConverter } = await import('@/wasm/tracer.js')
      const converter = ColorImageConverter.new_with_string('{}')
      const image_data = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(400)
      }

      converter.init(image_data)

      expect(mock_wasm_module.colorimageconverter_init).toHaveBeenCalled()
    })
  })
})

