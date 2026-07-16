import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AsPathCutout from '@/components/posters/as-path-cutout.vue'

const cutout = {
  getAttribute: vi.fn(name => {
    if (name === 'd') return 'M0 0 L10 10'
    if (name === 'fill') return '#abc'
    if (name === 'fill-opacity') return '0.4'
    if (name === 'transform') return 'scale(2)'
    return null
  }),
  dataset: { progress: '75' }
}

describe('@/components/posters/as-path-cutout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies cutout attributes onto the path', async () => {
    const wrapper = shallowMount(AsPathCutout, {
      props: { cutout },
      global: {
        provide: { vector: ref(null) }
      }
    })
    await nextTick()
    const path = wrapper.find('path')
    expect(path.attributes('d')).toBe('M0 0 L10 10')
    expect(path.attributes('fill')).toBe('#abc')
    expect(path.attributes('transform')).toBe('scale(2)')
    expect(path.attributes('data-progress')).toBe('75')
    expect(path.attributes('itemprop')).toBe('cutout')
  })

  it('clears transform when the vector becomes optimized', async () => {
    const vector = ref({ optimized: false })
    const wrapper = shallowMount(AsPathCutout, {
      props: { cutout },
      global: { provide: { vector } }
    })
    await nextTick()
    expect(wrapper.find('path').attributes('transform')).toBe('scale(2)')

    vector.value = { optimized: true }
    await nextTick()
    expect(wrapper.find('path').attributes('transform')).toBeUndefined()
  })
})
