import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Relations from '@/views/Relations.vue'
import { create_person } from '@/use/person'

describe('Relations', () => {
  const mock_store = {
    state: {
      me: create_person(),
      relations: []
    },
    dispatch: vi.fn()
  }

  const mount_relations = () => shallowMount(Relations, {
      global: {
        mocks: {
          $store: mock_store
        }
      }
    })

  describe('component', () => {
    it('renders relations view', () => {
      const wrapper = mount_relations()
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('store interactions', () => {
    it('dispatches load action', () => {
      mount_relations()
      expect(mock_store.dispatch).toHaveBeenCalledWith('load_relations')
    })
  })
})
