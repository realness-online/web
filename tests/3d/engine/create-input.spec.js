import { vi } from 'vite-plus/test'
import { create_input } from '@/3d/engine/create-input.js'

describe('create_input', () => {
  it('dispose removes window and canvas listeners', () => {
    const canvas = document.createElement('canvas')
    const keydown_spy = vi.spyOn(window, 'addEventListener')
    const keydown_remove = vi.spyOn(window, 'removeEventListener')

    const input = create_input({ canvas })
    input.dispose()

    expect(keydown_remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(keydown_remove).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(keydown_remove).toHaveBeenCalledWith('blur', expect.any(Function))

    keydown_spy.mockRestore()
    keydown_remove.mockRestore()
  })
})
