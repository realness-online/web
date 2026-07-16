import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AsAvatar from '@/components/posters/as-avatar.vue'

const { mock_use_reference, mock_load_cutout_flags } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    mock_use_reference: create_ref(false),
    mock_load_cutout_flags: vi.fn().mockResolvedValue({ boulders: true })
  }
})

vi.mock('@/use/poster-instances', () => ({
  use_poster_instance: () => ({
    use_reference: mock_use_reference
  })
}))

vi.mock('@/use/poster-dom-reference', () => ({
  poster_dom_id: id => id.replace(/\//g, '-').slice(1),
  poster_dom_href: id => `#${id.replace(/\//g, '-').slice(1)}`
}))

vi.mock('@/utils/geology', () => ({
  load_cutout_flags: mock_load_cutout_flags
}))

const itemid = '/+14151234356/posters/1000'

const mount = () =>
  shallowMount(AsAvatar, {
    props: { itemid, label: 'Scott' },
    global: {
      stubs: {
        'as-svg': {
          name: 'AsSvg',
          props: ['itemid', 'tabable', 'as_avatar'],
          emits: ['show', 'click'],
          template: '<svg class="as-svg-stub" />'
        },
        'as-poster-symbol': true
      }
    }
  })

describe('@/components/posters/as-avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_use_reference.value = false
  })

  it('renders as-svg when this instance owns the defs', () => {
    const wrapper = mount()
    expect(wrapper.findComponent({ name: 'AsSvg' }).exists()).toBe(true)
    expect(wrapper.find('svg[aria-roledescription]').exists()).toBe(false)
  })

  it('renders a use reference when another instance is canonical', () => {
    mock_use_reference.value = true
    const wrapper = mount()
    const svg = wrapper.find('svg[aria-roledescription="referenced poster"]')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('aria-label')).toBe('Scott')
    expect(wrapper.find('use').attributes('href')).toContain('14151234356')
    expect(wrapper.findComponent({ name: 'AsSvg' }).exists()).toBe(false)
  })

  it('emits show after loading cutouts and mounts poster symbols', async () => {
    const wrapper = mount()
    const shown_vector = { id: itemid }
    await wrapper
      .findComponent({ name: 'AsSvg' })
      .vm.$emit('show', shown_vector)
    await flushPromises()
    await nextTick()

    expect(mock_load_cutout_flags).toHaveBeenCalledWith(itemid)
    expect(wrapper.emitted('show')?.[0]?.[0]).toEqual(shown_vector)
    expect(wrapper.findComponent({ name: 'as-poster-symbol' }).exists()).toBe(
      true
    )
  })

  it('forwards click from as-svg', async () => {
    const wrapper = mount()
    await wrapper.findComponent({ name: 'AsSvg' }).vm.$emit('click', {
      type: 'click'
    })
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
