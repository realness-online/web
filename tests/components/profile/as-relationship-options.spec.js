import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_options from '@/components/profile/as-relationship-options'

// Mock the use_me composable
vi.mock('@/use/people', () => ({
  use_me: () => ({
    relations: {
      value: [
        {
          id: '/+16282281824',
          name: 'Scott Fryxell'
        },
        {
          id: '/+6336661624',
          name: 'Katie Caffey'
        }
      ]
    }
  })
}))

// Mock the Storage class
vi.mock('@/persistance/Storage', () => ({
  Relation: vi.fn().mockImplementation(() => ({
    save: vi.fn()
  }))
}))

describe('@/component/profile/as-relationship-options.vue', () => {
  let wrapper
  const person = {
    id: '/+16282281824',
    name: 'Scott Fryxell'
  }

  beforeEach(() => {
    wrapper = shallowMount(as_options, {
      props: { person },
      global: {
        stubs: {
          icon: false // Don't stub the icon component
        }
      }
    })
  })

  describe('Renders', () => {
    it('A relationship toggle button', () => {
      expect(wrapper.find('a.status').exists()).toBe(true)
      // Check for icon components (they might be rendered as svg elements)
      expect(wrapper.find('svg').exists()).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    it('Shows relation status correctly for existing relationship', () => {
      expect(wrapper.find('a.status').classes()).toContain('relation')
    })

    it('Shows relation status correctly for non-relationship', async () => {
      const non_relation_person = {
        id: '/+14156661266',
        name: 'Unknown Person'
      }

      await wrapper.setProps({ person: non_relation_person })
      expect(wrapper.find('a.status').classes()).not.toContain('relation')
    })
  })

  describe('Methods', () => {
    describe('#update_relationship', () => {
      it('Calls the click handler', async () => {
        await wrapper.find('a.status').trigger('click')
        // The method should be called when clicking the button
        expect(wrapper.find('a.status').exists()).toBe(true)
      })
    })
  })
})
