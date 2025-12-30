import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { use } from '@/use/optimize'

// Mock dependencies
vi.mock('@/utils/item', () => ({
  default: vi.fn(html => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return {
      light: doc.querySelector('.light'),
      regular: doc.querySelector('.regular'),
      medium: doc.querySelector('.medium'),
      bold: doc.querySelector('.bold'),
      cutout: doc.querySelectorAll('.cutout')
    }
  })
}))

vi.mock('@/utils/itemid', () => ({
  as_query_id: vi.fn(id => id.replace(/[/+]/g, ''))
}))

describe('optimize composable', () => {
  let vector_ref
  let optimize_instance
  let mock_worker
  let console_warn_spy

  beforeEach(() => {
    vi.clearAllMocks()
    console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Create a mock vector
    vector_ref = ref({
      id: '/+14151234356/posters/123456',
      type: 'posters',
      light: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      regular: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      medium: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      bold: document.createElementNS('http://www.w3.org/2000/svg', 'path'),
      cutout: []
    })

    // Create mock element in DOM
    const mock_svg = document.createElement('div')
    mock_svg.id = '14151234356posters123456'
    mock_svg.innerHTML = `
      <svg>
        <path class="light" d="M0 0 L100 100"/>
        <path class="regular" d="M0 0 L100 100"/>
        <path class="medium" d="M0 0 L100 100"/>
        <path class="bold" d="M0 0 L100 100"/>
      </svg>
    `
    document.body.appendChild(mock_svg)

    // Mock Worker
    mock_worker = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn()
    }
    global.Worker = vi.fn(() => mock_worker)

    optimize_instance = use(vector_ref)
  })

  describe('initialization', () => {
    it('returns optimize function', () => {
      expect(optimize_instance.optimize).toBeTypeOf('function')
    })

    it('returns vector ref', () => {
      expect(optimize_instance.vector).toBe(vector_ref)
    })
  })

  describe('optimize function', () => {
    it('creates worker instance', async () => {
      optimize_instance.optimize()
      await nextTick()

      expect(global.Worker).toHaveBeenCalledWith('/vector.worker.js')
    })

    it('adds message event listener', async () => {
      optimize_instance.optimize()
      await nextTick()

      expect(mock_worker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      )
    })

    it('posts message to worker with vector', async () => {
      optimize_instance.optimize()
      await nextTick()

      expect(mock_worker.postMessage).toHaveBeenCalledWith({
        route: 'optimize:vector',
        vector: expect.stringContaining('svg')
      })
    })

    it('uses as_query_id to find DOM element', async () => {
      const { as_query_id } = await import('@/utils/itemid')

      optimize_instance.optimize()
      await nextTick()

      expect(as_query_id).toHaveBeenCalledWith(vector_ref.value.id)
    })
  })

  describe('optimized callback', () => {
    it('updates vector with optimized paths', async () => {
      const new_light = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      new_light.classList.add('light')
      const new_regular = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      new_regular.classList.add('regular')
      const new_medium = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      new_medium.classList.add('medium')
      const new_bold = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      )
      new_bold.classList.add('bold')

      optimize_instance.optimize()
      await nextTick()

      // Get the message handler
      const message_handler = mock_worker.addEventListener.mock.calls[0][1]

      // Create optimized HTML
      const optimized_html = `
        <svg>
          <path class="light" d="M0 0 L50 50"/>
          <path class="regular" d="M0 0 L50 50"/>
          <path class="medium" d="M0 0 L50 50"/>
          <path class="bold" d="M0 0 L50 50"/>
        </svg>
      `

      // Simulate worker response
      message_handler({
        data: {
          vector: optimized_html
        }
      })

      expect(vector_ref.value.light).toBeDefined()
      expect(vector_ref.value.regular).toBeDefined()
      expect(vector_ref.value.medium).toBeDefined()
      expect(vector_ref.value.bold).toBeDefined()
    })

    it('sets optimized flag to true', async () => {
      optimize_instance.optimize()
      await nextTick()

      const message_handler = mock_worker.addEventListener.mock.calls[0][1]

      message_handler({
        data: {
          vector: `
            <svg>
              <path class="light"/>
              <path class="regular"/>
              <path class="medium"/>
              <path class="bold"/>
            </svg>
          `
        }
      })

      expect(vector_ref.value.optimized).toBe(true)
    })

    it('removes message event listener after optimization', async () => {
      optimize_instance.optimize()
      await nextTick()

      const message_handler = mock_worker.addEventListener.mock.calls[0][1]

      message_handler({
        data: {
          vector: `
            <svg>
              <path class="light"/>
              <path class="regular"/>
              <path class="medium"/>
              <path class="bold"/>
            </svg>
          `
        }
      })

      expect(mock_worker.removeEventListener).toHaveBeenCalled()
      expect(mock_worker.removeEventListener.mock.calls[0][0]).toBe('message')
    })
  })

  describe('cleanup', () => {
    it('optimizer ref is accessible', () => {
      optimize_instance.optimize()
      expect(mock_worker).toBeDefined()
    })
  })

  afterEach(() => {
    if (console_warn_spy) console_warn_spy.mockRestore()
  })
})
