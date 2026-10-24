import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import AsProfileChip from '@/components/posters/as-profile-chip.vue'

describe('as-profile-chip', () => {
  it('renders a label row with avatar, name, link', () => {
    const wrapper = mount(AsProfileChip, {
      props: {
        person: { id: '/+1', type: 'person', name: 'S' },
        display: 'label'
      },
      global: {
        stubs: {
          'as-avatar': true,
          icon: true,
          'router-link': { template: '<a><slot /></a>', props: ['to'] }
        }
      }
    })
    expect(wrapper.find('a[data-display="label"]').exists()).toBe(true)
  })
  it('renders with poster_itemid when no avatar', () => {
    const wrapper = mount(AsProfileChip, {
      props: {
        person: { id: '/+1', type: 'person', name: 'S', avatar: undefined },
        display: 'label',
        poster_itemid: '/+1/posters/123'
      },
      global: {
        stubs: {
          'as-avatar': true,
          icon: true,
          'router-link': { template: '<a><slot /></a>', props: ['to'] }
        }
      }
    })
    expect(wrapper.find('[data-display]').exists()).toBe(true)
  })
})
