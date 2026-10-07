import { vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import no_ai from '@/components/no-ai'

// mirrors the constants in the component
const HOLD_MS = 1500
const BREAK_MS = 700
const SETTLE_MS = 420
const ESCAPE_MS = 2600
const SPARK_COUNT = 24

const mark = wrapper => wrapper.find("svg[data-icon='no-ai']")
const state = wrapper => mark(wrapper).attributes('data-state')
const loose = () => document.querySelectorAll('div.no-ai-escape > svg')

describe('@/components/no-ai', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
    wrapper = mount(no_ai, { attachTo: document.body })
  })

  afterEach(() => {
    wrapper.unmount()
    vi.useRealTimers()
  })

  describe('Renders', () => {
    it('The mark, inline, with every part addressable', () => {
      expect(mark(wrapper).exists()).toBe(true)
      expect(wrapper.findAll('path[data-sparkle]')).toHaveLength(3)
      expect(wrapper.findAll('rect[data-slash]')).toHaveLength(2)
      expect(state(wrapper)).toBeUndefined()
    })
  })

  describe('Holding the mark', () => {
    it('Strains while held', async () => {
      await mark(wrapper).trigger('pointerdown')
      expect(state(wrapper)).toBe('straining')
      expect(loose()).toHaveLength(0)
    })

    it('Settles back when released before it gives', async () => {
      await mark(wrapper).trigger('pointerdown')
      vi.advanceTimersByTime(HOLD_MS - 1)
      await mark(wrapper).trigger('pointerup')

      expect(state(wrapper)).toBe('settling')
      expect(loose()).toHaveLength(0)

      vi.advanceTimersByTime(SETTLE_MS)
      await wrapper.vm.$nextTick()
      expect(state(wrapper)).toBeUndefined()
    })

    it('Breaks free and gets loose across the viewport', async () => {
      await mark(wrapper).trigger('pointerdown')
      vi.advanceTimersByTime(HOLD_MS)
      await wrapper.vm.$nextTick()

      expect(state(wrapper)).toBe('escaped')
      expect(loose()).toHaveLength(SPARK_COUNT)
    })

    it('Reassembles while the sparks are still flying', async () => {
      await mark(wrapper).trigger('pointerdown')
      vi.advanceTimersByTime(HOLD_MS + BREAK_MS + SETTLE_MS)
      await wrapper.vm.$nextTick()

      expect(state(wrapper)).toBeUndefined()
      expect(loose()).toHaveLength(SPARK_COUNT)

      vi.advanceTimersByTime(ESCAPE_MS)
      await wrapper.vm.$nextTick()
      expect(loose()).toHaveLength(0)
    })

    it('Can be set off again', async () => {
      await mark(wrapper).trigger('pointerdown')
      vi.advanceTimersByTime(HOLD_MS + BREAK_MS + SETTLE_MS + ESCAPE_MS)
      await wrapper.vm.$nextTick()

      await mark(wrapper).trigger('pointerdown')
      expect(state(wrapper)).toBe('straining')

      vi.advanceTimersByTime(HOLD_MS)
      await wrapper.vm.$nextTick()
      expect(loose()).toHaveLength(SPARK_COUNT)
    })

    it('Ignores a second press while it is already going', async () => {
      await mark(wrapper).trigger('pointerdown')
      vi.advanceTimersByTime(HOLD_MS)
      await wrapper.vm.$nextTick()

      await mark(wrapper).trigger('pointerdown')
      expect(state(wrapper)).toBe('escaped')
    })
  })
})
