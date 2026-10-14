import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import * as Queue from '@/persistence/Queue'
import {
  use_queue,
  queue_items,
  current_processing,
  is_processing,
  update_progress
} from '@/use/vectorize/queue'

vi.mock('@/persistence/Queue', () => ({
  add: vi.fn(() => Promise.resolve()),
  get_all: vi.fn(() => Promise.resolve([])),
  get_next: vi.fn(() => Promise.resolve(null)),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve())
}))

vi.mock('@/utils/algorithms', () => {
  const mutex = { lock: vi.fn(() => Promise.resolve()), unlock: vi.fn() }
  return { mutex_for: () => mutex }
})

const item = (id, overrides = {}) => ({
  id,
  itemid: id,
  status: 'pending',
  progress: 0,
  resized_blob: new Blob(['x'], { type: 'image/jpeg' }),
  width: 10,
  height: 10,
  ...overrides
})

const make_queue = (overrides = {}) => {
  const deps = {
    mount_workers: vi.fn(),
    unmount_workers: vi.fn(),
    vectorize: vi.fn(() => Promise.resolve()),
    reset: vi.fn(),
    resize_to_blob: vi.fn(() =>
      Promise.resolve({ blob: new Blob(['x']), width: 10, height: 10 })
    ),
    ...overrides
  }
  return { queue: use_queue(deps), deps }
}

describe('@/use/vectorize/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queue_items.value = []
    current_processing.value = null
    is_processing.value = false
    localStorage.me = '/+14151234356'
  })

  describe('update_progress', () => {
    it('records progress against the matching item', () => {
      queue_items.value = [item('/+1/posters/1')]

      update_progress('/+1/posters/1', 42)

      expect(queue_items.value[0].progress).toBe(42)
    })

    it('ignores an item that is not in the queue', () => {
      queue_items.value = [item('/+1/posters/1')]

      expect(() => update_progress('/+1/posters/2', 42)).not.toThrow()
      expect(queue_items.value[0].progress).toBe(0)
    })
  })

  describe('add_to_queue', () => {
    it('resizes and queues a supported file', async () => {
      const { queue } = make_queue()
      Queue.get_next.mockResolvedValue(null)
      const file = new File(['x'], 'a.png', { type: 'image/png' })

      await queue.add_to_queue([file])

      expect(Queue.add).toHaveBeenCalled()
      expect(queue_items.value.length).toBeGreaterThan(0)
    })

    it('skips a file over the browser size limit', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { queue } = make_queue()
      const big = new File(['x'], 'huge.png', { type: 'image/png' })
      Object.defineProperty(big, 'size', { value: 201 * 1024 * 1024 })

      await queue.add_to_queue([big])

      expect(Queue.add).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Files skipped')
      )
      error.mockRestore()
    })

    it('reports a file that fails to resize', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { queue } = make_queue({
        resize_to_blob: vi.fn(() => Promise.reject(new Error('no decode')))
      })
      const file = new File(['x'], 'bad.png', { type: 'image/png' })

      await queue.add_to_queue([file])

      expect(error).toHaveBeenCalledWith(
        'Failed to add bad.png to queue:',
        'no decode'
      )
      expect(Queue.add).not.toHaveBeenCalled()
      error.mockRestore()
    })
  })

  describe('process_queue', () => {
    it('unmounts the workers when there is nothing to do', async () => {
      const { queue, deps } = make_queue()

      await queue.process_queue()

      expect(deps.unmount_workers).toHaveBeenCalled()
      expect(is_processing.value).toBe(false)
    })

    it('hands the next item to the vectorizer', async () => {
      const next = item('/+1/posters/9')
      Queue.get_next.mockResolvedValue(next)
      queue_items.value = [{ ...next }]
      const { queue, deps } = make_queue()

      await queue.process_queue()

      expect(deps.vectorize).toHaveBeenCalledWith(expect.anything(), next.id)
      expect(Queue.update).toHaveBeenCalledWith(next.id, {
        status: 'processing'
      })
    })

    it('marks an item with no image as an error and moves on', async () => {
      const next = item('/+1/posters/10', { resized_blob: null })
      Queue.get_next.mockResolvedValueOnce(next).mockResolvedValue(null)
      queue_items.value = [{ ...next }]
      const { queue, deps } = make_queue()

      await queue.process_queue()

      expect(Queue.update).toHaveBeenCalledWith(next.id, { status: 'error' })
      expect(queue_items.value[0].status).toBe('error')
      expect(deps.vectorize).not.toHaveBeenCalled()
    })

    it('wraps a stored array buffer back into a blob', async () => {
      const next = item('/+1/posters/11', {
        resized_blob: new ArrayBuffer(4)
      })
      Queue.get_next.mockResolvedValue(next)
      queue_items.value = [{ ...next }]
      const { queue, deps } = make_queue()

      await queue.process_queue()

      const passed = deps.vectorize.mock.calls[0][0]
      expect(passed).toBeInstanceOf(Blob)
    })

    it('marks the item failed and keeps going when the vectorizer throws', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const next = item('/+1/posters/12')
      Queue.get_next.mockResolvedValueOnce(next).mockResolvedValue(null)
      queue_items.value = [{ ...next }]
      const { queue, deps } = make_queue({
        vectorize: vi.fn(() => Promise.reject(new Error('worker died')))
      })

      await queue.process_queue()

      expect(Queue.update).toHaveBeenCalledWith(next.id, { status: 'error' })
      expect(deps.reset).toHaveBeenCalled()
      expect(is_processing.value).toBe(false)
      error.mockRestore()
    })

    it('reports a non-Error rejection through its string form', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const next = item('/+1/posters/13')
      Queue.get_next.mockResolvedValueOnce(next).mockResolvedValue(null)
      queue_items.value = [{ ...next }]
      const { queue } = make_queue({
        vectorize: vi.fn(() => Promise.reject('plain text failure'))
      })

      await queue.process_queue()

      expect(error).toHaveBeenCalledWith(
        'Error processing queue item:',
        'plain text failure'
      )
      error.mockRestore()
    })
  })

  describe('init_processing_queue', () => {
    it('resets a stuck item back to pending', async () => {
      const stuck = item('/+1/posters/14', { status: 'processing' })
      Queue.get_all.mockResolvedValue([{ ...stuck }])
      Queue.get_next.mockResolvedValue(null)
      const { queue, deps } = make_queue()

      await queue.init_processing_queue()

      expect(Queue.update).toHaveBeenCalledWith(stuck.id, {
        status: 'pending'
      })
      expect(deps.mount_workers).toHaveBeenCalled()
    })

    it('does not start work for an empty queue', async () => {
      Queue.get_all.mockResolvedValue([])
      const { queue, deps } = make_queue()

      await queue.init_processing_queue()

      expect(deps.mount_workers).not.toHaveBeenCalled()
    })

    it('processes what is already queued', async () => {
      Queue.get_all.mockResolvedValue([item('/+1/posters/15')])
      Queue.get_next.mockResolvedValue(null)
      const { queue, deps } = make_queue()

      await queue.init_processing_queue()

      expect(deps.mount_workers).toHaveBeenCalled()
    })
  })
})
