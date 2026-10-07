import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_feed_toggle from '@/components/thoughts/as-feed-toggle'

describe('@/components/thoughts/as-feed-toggle.vue', () => {
  let wrapper

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    wrapper?.unmount()
  })

  const mount_comp = (model = false) => {
    wrapper = shallowMount(as_feed_toggle, {
      props: { modelValue: model }
    })
    return wrapper
  }

  const button_attr = name => wrapper.get('button').element.getAttribute(name)

  it('renders a toggle switch with the model value as aria-checked', () => {
    const w = mount_comp(true)
    expect(w.get('button').attributes('role')).toBe('switch')
    expect(w.get('button').attributes('aria-checked')).toBe('true')
  })

  it('toggles from off to on and starts a leaving motion', async () => {
    mount_comp(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(true)
    expect(button_attr('data-leave')).toBe('phonebook')
    expect(button_attr('data-enter')).toBeNull()
  })

  it('toggles from on to off and starts an entering motion', async () => {
    mount_comp(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(false)
    expect(button_attr('data-enter')).toBe('phonebook')
    expect(button_attr('data-leave')).toBeNull()
  })

  it('clears the motion state after the animation window', async () => {
    mount_comp(false)
    await wrapper.get('button').trigger('click')
    expect(button_attr('data-leave')).toBe('phonebook')
    vi.advanceTimersByTime(600)
    await flushPromises()
    expect(button_attr('data-leave')).toBeNull()
    expect(button_attr('data-enter')).toBeNull()
  })

  it('restarts the timer on a second toggle before the first resolves', async () => {
    mount_comp(true)
    await wrapper.get('button').trigger('click') // on -> off
    await flushPromises()
    expect(button_attr('data-enter')).toBe('phonebook')
    vi.advanceTimersByTime(100)
    await wrapper.get('button').trigger('click') // off -> on, restarts window
    await flushPromises()
    expect(button_attr('data-leave')).toBe('phonebook')
    vi.advanceTimersByTime(500)
    await flushPromises()
    expect(button_attr('data-leave')).toBe('phonebook')
    vi.advanceTimersByTime(100)
    await flushPromises()
    expect(button_attr('data-leave')).toBeNull()
  })
})
