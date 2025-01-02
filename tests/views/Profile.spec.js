import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Profile from '@/views/Profile.vue'
import { create_person } from '@/use/person'

describe('Profile', () => {
  const mock_router = {
    push: vi.fn()
  }

  const mock_store = {
    state: {
      me: create_person()
    }
  }

  const mount_profile = () =>
    shallowMount(Profile, {
      global: {
        mocks: {
          $router: mock_router,
          $store: mock_store
        }
      }
    })

  it('renders profile view', () => {
    const wrapper = mount_profile()
    expect(wrapper.exists()).toBe(true)
  })

  describe('navigation', () => {
    it('navigates on action', () => {
      const wrapper = mount_profile()
      wrapper.vm.navigate()
      expect(mock_router.push).toHaveBeenCalled()
    })
  })
})
