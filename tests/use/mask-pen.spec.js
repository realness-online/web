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

  it('paints into the active subject, auto-creating one', () => {
    const pen = use_mask_pen()
    pen.toggle_path('sand:0')
    expect(pen.subjects.value).toHaveLength(1)
    expect(pen.active_subject.value?.keys.has('sand:0')).toBe(true)
  })

  it('keeps cell ownership exclusive across subjects', () => {
    const pen = use_mask_pen()
    const first = pen.add_subject('Flower')
    pen.toggle_path('rocks:1')
    const second = pen.add_subject('Foreground')
    pen.toggle_path('rocks:1')

    expect(second.keys.has('rocks:1')).toBe(true)
    expect(first.keys.has('rocks:1')).toBe(false)
    expect(pen.owner_of('rocks:1')?.id).toBe(second.id)
  })

  it('selects, renames and removes subjects', () => {
    const pen = use_mask_pen()
    const a = pen.add_subject('A')
    const b = pen.add_subject('B')
    expect(pen.active_subject_id.value).toBe(b.id)

    pen.select_subject(a.id)
    expect(pen.active_subject.value?.id).toBe(a.id)

    pen.rename_subject(a.id, 'Face')
    expect(pen.subjects.value.find(s => s.id === a.id)?.name).toBe('Face')

    pen.remove_subject(a.id)
    expect(pen.subjects.value).toHaveLength(1)
    expect(pen.active_subject_id.value).toBe(b.id)
  })

  it('clear empties only the active subject', () => {
    const pen = use_mask_pen()
    const a = pen.add_subject('A')
    pen.toggle_path('sand:0')
    const b = pen.add_subject('B')
    pen.toggle_path('sand:1')

    pen.clear()
    expect(b.keys.size).toBe(0)
    expect(a.keys.has('sand:0')).toBe(true)
  })
})
