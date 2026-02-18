import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Fps from '@/components/fps.vue'

const mock_fps = ref(0)

vi.mock('@vueuse/core', () => ({
  useFps: () => mock_fps
}))

vi.mock('@/utils/preference', () => ({
  animate: ref(false),
  animation_speed: ref('normal'),
  aspect_ratio_mode: ref('auto'),
  slice: ref(false)
}))

describe('fps component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_fps.value = 60
  })

  it('renders fps value in first meter', () => {
    mock_fps.value = 42
    const wrapper = mount(Fps)
    const meter = wrapper.find('aside#fps meter:first-of-type')
    expect(meter.attributes('value')).toBe('42')
    expect(meter.text()).toContain('42fps')
    wrapper.unmount()
  })

  it('updates when fps ref changes', async () => {
    const wrapper = mount(Fps)
    expect(
      wrapper.find('aside#fps meter:first-of-type').attributes('value')
    ).toBe('60')

    mock_fps.value = 30
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('aside#fps meter:first-of-type').attributes('value')
    ).toBe('30')

    wrapper.unmount()
  })

  it('sets green color for good fps (>= 51)', () => {
    mock_fps.value = 55
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: green')
    wrapper.unmount()
  })

  it('sets orange color for acceptable fps (24-49)', () => {
    mock_fps.value = 30
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: orange')
    wrapper.unmount()
  })

  it('sets red color for low fps (< 24)', () => {
    mock_fps.value = 15
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: red')
    wrapper.unmount()
  })

  it('shows animation status and aspect ratio', () => {
    const wrapper = mount(Fps)
    const outputs = wrapper.findAll('aside#fps output')
    expect(outputs).toHaveLength(2)
    expect(outputs[0].text()).toContain('anim:')
    expect(outputs[1].text()).toContain('aspect:')
    wrapper.unmount()
  })
})
