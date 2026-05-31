import { describe, it, expect } from 'vite-plus/test'
import { use_mask_pen } from '@/use/mask-pen'

describe('@/use/mask-pen', () => {
  it('toggle_path replaces selected Set on single toggles', () => {
    const pen = use_mask_pen()
    pen.toggle_path('sand:0')
    expect(pen.selected.value.has('sand:0')).toBe(true)
  })

  it('paint session batches Set updates until pointer up', () => {
    const pen = use_mask_pen()
    pen.toggle_path('sand:0')

    pen.handle_pointerdown('sand:1')
    pen.handle_pointermove('sand:2')
    expect(pen.selected.value.has('sand:1')).toBe(true)
    expect(pen.selected.value.has('sand:2')).toBe(true)

    pen.handle_pointerup()
    expect(pen.selected.value.has('sand:0')).toBe(true)
    expect(pen.selected.value.has('sand:1')).toBe(true)
    expect(pen.selected.value.has('sand:2')).toBe(true)
    expect(pen.painting.value).toBe(false)
  })

  it('paint session erases when starting on a selected path', () => {
    const pen = use_mask_pen()
    pen.toggle_path('sand:0')
    pen.toggle_path('sand:1')

    pen.handle_pointerdown('sand:0')
    pen.handle_pointermove('sand:1')
    pen.handle_pointerup()

    expect(pen.selected.value.has('sand:0')).toBe(false)
    expect(pen.selected.value.has('sand:1')).toBe(false)
  })

  it('tracks hovered key on pointer move', () => {
    const pen = use_mask_pen()
    pen.handle_pointermove('gravel:3')
    expect(pen.hovered_key.value).toBe('gravel:3')
  })
})
