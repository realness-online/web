import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import as_masks from '@/components/posters/as-masks'

const itemid = '/+14151234356/posters/1770000000000'

describe('@/components/posters/as-masks.vue', () => {
  it('renders horizontal, radial, and vertical masks with suffixed ids', () => {
    const wrapper = shallowMount(as_masks, { props: { itemid } })
    const masks = wrapper.findAll('mask')
    expect(masks).toHaveLength(3)
    expect(masks[0].attributes('id')).toContain('horizontal-mask')
    expect(masks[1].attributes('id')).toContain('radial-mask')
    expect(masks[2].attributes('id')).toContain('vertical-mask')
  })

  it('fills each mask rect with a fragment url suffix', () => {
    const wrapper = shallowMount(as_masks, { props: { itemid } })
    const fills = wrapper.findAll('rect').map(r => r.attributes('fill'))
    expect(fills).toHaveLength(3)
    expect(fills[0]).toMatch(/url\(.+horizontal-background\)/)
    expect(fills[1]).toMatch(/url\(.+radial-background\)/)
    expect(fills[2]).toMatch(/url\(.+vertical-background\)/)
  })

  it('falls back to the suffix for a query when itemid is missing', () => {
    // query(add) returns add when props.itemid is falsy
    const wrapper = shallowMount(as_masks, { props: { itemid: '' } })
    const masks = wrapper.findAll('mask')
    expect(masks[0].attributes('id')).toBe('horizontal-mask')
  })

  it('emits one mask per subject from the live subject list', () => {
    const subjects = {
      value: [
        { id: '1700000900001', name: 'Flower', keys: new Set(['rocks:3']) },
        { id: '1700000900002', name: 'Foreground', keys: new Set(['sand:7']) }
      ]
    }
    const wrapper = shallowMount(as_masks, {
      props: { itemid },
      global: { provide: { 'mask-pen': { subjects } } }
    })
    const masks = wrapper.findAll('mask')
    // 3 base masks + 1 per subject
    expect(masks).toHaveLength(5)
    expect(masks[3].attributes('id')).toContain(`subjects/1700000900001`)
    expect(masks[4].attributes('id')).toContain(`subjects/1700000900002`)
  })
})
