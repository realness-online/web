import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { ref, nextTick } from 'vue'
import { use_smil_fade } from '@/use/smil-fade'

const set_duration = (name, value) => {
  document.documentElement.style.setProperty(name, value)
}

describe('@/use/smil-fade', () => {
  beforeEach(() => {
    set_duration('--duration-subject', '440ms')
  })

  it('fades from the previous value to the new one', async () => {
    const target = ref(0.2)
    const animate = { setAttribute: vi.fn(), beginElement: vi.fn() }

    use_smil_fade(ref(animate), () => target.value)
    target.value = 0.9
    await nextTick()

    expect(animate.setAttribute).toHaveBeenCalledWith('values', '0.2;0.9')
    expect(animate.beginElement).toHaveBeenCalled()
  })

  it('sets the duration from the motion constant', async () => {
    const target = ref(1)
    const animate = { setAttribute: vi.fn(), beginElement: vi.fn() }

    use_smil_fade(ref(animate), () => target.value)
    target.value = 2
    await nextTick()

    expect(animate.setAttribute).toHaveBeenCalledWith('dur', '0.44s')
  })

  it('does nothing when there is no animate element', async () => {
    const target = ref(1)

    use_smil_fade(ref(null), () => target.value)

    await expect(
      (async () => {
        target.value = 2
        await nextTick()
      })()
    ).resolves.toBeUndefined()
  })

  it('does not fade on the first value', async () => {
    const target = ref(1)
    const animate = { setAttribute: vi.fn(), beginElement: vi.fn() }

    use_smil_fade(ref(animate), () => target.value)
    await nextTick()

    expect(animate.setAttribute).not.toHaveBeenCalled()
  })

  it('skips a fade too short to see', async () => {
    set_duration('--duration-subject', '4ms')
    const target = ref(1)
    const animate = { setAttribute: vi.fn(), beginElement: vi.fn() }

    use_smil_fade(ref(animate), () => target.value)
    target.value = 2
    await nextTick()

    expect(animate.beginElement).not.toHaveBeenCalled()
  })

  it('accepts another motion constant for the duration', async () => {
    set_duration('--duration-camera', '800ms')
    const target = ref(1)
    const animate = { setAttribute: vi.fn(), beginElement: vi.fn() }

    use_smil_fade(ref(animate), () => target.value, {
      duration: '--duration-camera'
    })
    target.value = 2
    await nextTick()

    expect(animate.setAttribute).toHaveBeenCalledWith('dur', '0.8s')
  })
})
