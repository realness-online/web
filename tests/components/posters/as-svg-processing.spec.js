import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import AsSvgProcessing from '@/components/posters/as-svg-processing.vue'

vi.mock('@/utils/itemid', () => ({
  as_query_id: id => `q-${String(id).replace(/\//g, '-')}`,
  as_fragment_id: id => `#q-${String(id).replace(/\//g, '-')}`,
  as_layer_id: (id, layer) => `${id}/${layer}`
}))

const stub = name => ({
  name,
  template: `<div class="${name}-stub" />`
})

const queue_item = (overrides = {}) => ({
  id: '/+14151234356/posters/1000',
  itemid: '/+14151234356/posters/1000',
  status: 'queued',
  width: 800,
  height: 600,
  resized_blob: null,
  ...overrides
})

const mount = ({
  item = queue_item(),
  new_vector = null,
  current_processing = null
} = {}) =>
  shallowMount(AsSvgProcessing, {
    props: { queue_item: item },
    global: {
      provide: {
        new_vector: ref(new_vector),
        current_processing: ref(current_processing)
      },
      stubs: {
        icon: true,
        'as-svg': stub('AsSvg'),
        'as-path-cutout': true,
        'as-symbol-shadow': true,
        'as-path': true,
        'as-background': true
      }
    }
  })

describe('@/components/posters/as-svg-processing', () => {
  let create_object_url
  let revoke_object_url
  let original_create
  let original_revoke

  beforeEach(() => {
    original_create = URL.createObjectURL
    original_revoke = URL.revokeObjectURL
    create_object_url = vi.fn(() => 'blob:thumb')
    revoke_object_url = vi.fn()
    URL.createObjectURL = create_object_url
    URL.revokeObjectURL = revoke_object_url
  })

  afterEach(() => {
    URL.createObjectURL = original_create
    URL.revokeObjectURL = original_revoke
  })

  it('marks landscape orientation from queue dimensions', () => {
    const wrapper = mount()
    expect(
      wrapper.find("figure[itemtype='/posters']").attributes('data-orientation')
    ).toBe('horizontal')
  })

  it('marks portrait orientation when taller than wide', () => {
    const wrapper = mount({
      item: queue_item({ width: 400, height: 800 })
    })
    expect(
      wrapper.find("figure[itemtype='/posters']").attributes('data-orientation')
    ).toBe('vertical')
  })

  it('creates and revokes a thumbnail object url', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    const wrapper = mount({ item: queue_item({ resized_blob: blob }) })
    await flushPromises()
    expect(create_object_url).toHaveBeenCalled()
    expect(wrapper.find('img').attributes('src')).toBe('blob:thumb')
    wrapper.unmount()
    expect(revoke_object_url).toHaveBeenCalledWith('blob:thumb')
  })

  it('accepts ArrayBuffer resized blobs', async () => {
    const buffer = new ArrayBuffer(8)
    mount({ item: queue_item({ resized_blob: buffer }) })
    await flushPromises()
    expect(create_object_url).toHaveBeenCalled()
    const arg = create_object_url.mock.calls[0][0]
    expect(arg).toBeInstanceOf(Blob)
  })

  it('shows processing svg while tracing the current item', () => {
    const item = queue_item({ status: 'processing' })
    const wrapper = mount({
      item,
      current_processing: item,
      new_vector: {
        optimized: false,
        background: {},
        light: {},
        regular: {},
        medium: {},
        bold: {},
        cutout: [{}]
      }
    })
    expect(wrapper.find('figure').attributes('aria-busy')).toBe('true')
    expect(wrapper.findComponent({ name: 'AsSvg' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'icon' }).exists()).toBe(true)
  })

  it('shows save svg and geology symbols when optimized', () => {
    const item = queue_item({ status: 'processing' })
    const wrapper = mount({
      item,
      current_processing: item,
      new_vector: {
        optimized: true,
        cutouts: { sand: { innerHTML: '<path d="M1"/>' } }
      }
    })
    expect(wrapper.findAllComponents({ name: 'AsSvg' })).toHaveLength(1)
    expect(
      wrapper.find('symbol[itemid="/+14151234356/posters/1000/sand"]').exists()
    ).toBe(true)
  })
})
