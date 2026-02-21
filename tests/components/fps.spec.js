import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Fps from '@/components/fps.vue'

const mock_fps = ref(0)

vi.mock('@vueuse/core', () => ({
  useFps: () => mock_fps
}))

vi.mock('@/utils/preference', () => ({
  adaptive_enabled: ref(true),
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

  it('renders fps value as number and in meter', () => {
    mock_fps.value = 42
    const wrapper = mount(Fps)
    expect(wrapper.find('aside#fps > div > output').text()).toContain('42 fps')
    const meter = wrapper.find('aside#fps > div > meter')
    expect(meter.attributes('value')).toBe('42')
    wrapper.unmount()
  })

  it('updates when fps ref changes', async () => {
    const wrapper = mount(Fps)
    expect(wrapper.find('aside#fps > div > meter').attributes('value')).toBe(
      '60'
    )

    mock_fps.value = 30
    await wrapper.vm.$nextTick()
    const value = Number(
      wrapper.find('aside#fps > div > meter').attributes('value')
    )
    expect(value).toBeLessThan(60)
    expect(value).toBeGreaterThanOrEqual(0)

    wrapper.unmount()
  })

  it('sets green color for fps >= 24', () => {
    mock_fps.value = 30
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: green')
    wrapper.unmount()
  })

  it('sets yellow color for fps 12-24', () => {
    mock_fps.value = 18
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: yellow')
    wrapper.unmount()
  })

  it('sets red color for fps < 12', () => {
    mock_fps.value = 8
    const wrapper = mount(Fps)
    const style = wrapper.find('aside#fps').attributes('style')
    expect(style).toContain('--fps-color: red')
    wrapper.unmount()
  })

  it('shows fps number, animation status, adaptive toggle and aspect ratio', () => {
    const wrapper = mount(Fps)
    expect(wrapper.find('aside#fps > div > output').text()).toMatch(/\d+ fps/)
    const outputs = wrapper.findAll('aside#fps > output')
    expect(outputs).toHaveLength(3)
    expect(outputs[0].text()).toContain('anim:')
    expect(outputs[1].text()).toContain('adaptive:')
    expect(outputs[2].text()).toContain('aspect:')
    wrapper.unmount()
  })
})
