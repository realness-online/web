import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { use_deferred_unmount, duration_of } from '@/use/deferred-unmount'

describe('@/use/deferred-unmount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-subject', '440ms')
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.style.removeProperty('--duration-subject')
  })

  describe('duration_of', () => {
    it('reads milliseconds off the root', () => {
      expect(duration_of('--duration-subject')).toBe(440)
    })

    it('converts seconds', () => {
      document.documentElement.style.setProperty('--duration-subject', '0.28s')
      expect(duration_of('--duration-subject')).toBe(280)
    })

    it('is zero for a constant that is not there', () => {
      expect(duration_of('--nope')).toBe(0)
    })
  })

  describe('holding a key past the flip', () => {
    it('keeps it until the hold elapses', async () => {
      const showing = ref(['sand', 'rocks'])
      const { keys, leaving } = use_deferred_unmount(() => showing.value)

      showing.value = ['sand']
      await nextTick()

      expect(keys.value).toEqual(['sand', 'rocks'])
      expect(leaving.value.has('rocks')).toBe(true)

      vi.advanceTimersByTime(490)
      expect(keys.value).toEqual(['sand'])
    })

    it('waits out a staggered exit before dropping the last one', async () => {
      document.documentElement.style.setProperty('--stagger-step', '60ms')
      const showing = ref(['sand'])
      const { keys } = use_deferred_unmount(() => showing.value, { steps: 4 })

      showing.value = []
      await nextTick()

      vi.advanceTimersByTime(490)
      expect(keys.value).toEqual(['sand'])
      vi.advanceTimersByTime(250)
      expect(keys.value).toEqual([])
    })

    it('asks a steps function at the moment of the hold', async () => {
      document.documentElement.style.setProperty('--stagger-step', '60ms')
      const staggering = ref(false)
      const showing = ref(['sand'])
      const { keys } = use_deferred_unmount(() => showing.value, {
        steps: () => (staggering.value ? 4 : 0)
      })

      // Nothing staggered this exit, so it holds for the fade alone.
      showing.value = []
      await nextTick()
      vi.advanceTimersByTime(490)
      expect(keys.value).toEqual([])

      staggering.value = true
      showing.value = ['sand']
      await nextTick()
      showing.value = []
      await nextTick()
      vi.advanceTimersByTime(490)
      expect(keys.value).toEqual(['sand'])
      vi.advanceTimersByTime(250)
      expect(keys.value).toEqual([])
    })

    it('drops it early when the transition ends', async () => {
      const showing = ref(['rocks'])
      const { keys, end } = use_deferred_unmount(() => showing.value)

      showing.value = []
      await nextTick()
      end('rocks')

      expect(keys.value).toEqual([])
    })

    it('takes a key back if it returns mid-transition', async () => {
      const showing = ref(['rocks'])
      const { keys, leaving } = use_deferred_unmount(() => showing.value)

      showing.value = []
      await nextTick()
      showing.value = ['rocks']
      await nextTick()

      vi.advanceTimersByTime(490)
      expect(leaving.value.size).toBe(0)
      expect(keys.value).toEqual(['rocks'])
    })
  })

  it('clears its timers when the scope goes away', async () => {
    const showing = ref(['rocks'])
    const scope = effectScope()
    scope.run(() => use_deferred_unmount(() => showing.value))

    showing.value = []
    await nextTick()
    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })
})
