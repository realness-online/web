import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { ref } from 'vue'
import { use_file_input } from '@/use/vectorize/file-input'

const make_picker = () => {
  const el = document.createElement('input')
  el.type = 'file'
  return ref(el)
}

const blob = (type = 'image/png') => new Blob(['x'], { type })

describe('@/use/vectorize/file-input', () => {
  let mocks

  beforeEach(() => {
    mocks = {
      add_to_queue: vi.fn(async () => {})
    }
  })

  it('queue_supported_files returns false when nothing is supported', async () => {
    const { queue_supported_files } = use_file_input(
      make_picker(),
      mocks.add_to_queue
    )
    const ok = await queue_supported_files([
      { name: 'a.pdf', type: 'application/pdf' }
    ])
    expect(ok).toBe(false)
    expect(mocks.add_to_queue).not.toHaveBeenCalled()
  })

  it('queue_supported_files filters and queues only supported files', async () => {
    const { queue_supported_files } = use_file_input(
      make_picker(),
      mocks.add_to_queue
    )
    const ok = await queue_supported_files([
      { name: 'a.png', type: 'image/png' },
      { name: 'b.pdf', type: 'application/pdf' }
    ])
    expect(ok).toBe(true)
    expect(mocks.add_to_queue).toHaveBeenCalledTimes(1)
    const files = mocks.add_to_queue.mock.calls[0][0]
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('a.png')
  })

  it('queue_supported_clipboard_items maps a matching type to a file', async () => {
    const { queue_supported_clipboard_items } = use_file_input(
      make_picker(),
      mocks.add_to_queue
    )
    const item = {
      types: ['text/plain', 'image/webp'],
      getType: vi.fn(async t => blob())
    }
    const ok = await queue_supported_clipboard_items([item])
    expect(ok).toBe(true)
    expect(item.getType).toHaveBeenCalledWith('image/webp')
    const files = mocks.add_to_queue.mock.calls[0][0]
    expect(files).toHaveLength(1)
    expect(files[0].name).toMatch(/^clipboard-\d+\.webp$/)
  })

  it('queue_supported_clipboard_items returns false with no supported type', async () => {
    const { queue_supported_clipboard_items } = use_file_input(
      make_picker(),
      mocks.add_to_queue
    )
    const ok = await queue_supported_clipboard_items([
      { types: ['text/plain'] }
    ])
    expect(ok).toBe(false)
    expect(mocks.add_to_queue).not.toHaveBeenCalled()
  })

  it('select_photo stamps multiple and clicks the picker', () => {
    const picker = make_picker()
    const { select_photo } = use_file_input(picker, mocks.add_to_queue)
    const click = vi.spyOn(picker.value, 'click')
    select_photo()
    expect(picker.value.hasAttribute('multiple')).toBe(true)
    expect(picker.value.hasAttribute('capture')).toBe(false)
    expect(click).toHaveBeenCalled()
  })

  it('open_camera sets the environment capture attribute', () => {
    const picker = make_picker()
    const { open_camera } = use_file_input(picker, mocks.add_to_queue)
    const click = vi.spyOn(picker.value, 'click')
    open_camera()
    expect(picker.value.getAttribute('capture')).toBe('environment')
    expect(click).toHaveBeenCalled()
  })
})
