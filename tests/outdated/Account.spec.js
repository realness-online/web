import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import Account from '@/views/Account'
import { create_router } from '@/router'

describe('@/views/Account', () => {
  let wrapper
  const mock_user = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mock('@/router', () => ({
      create_router: vi.fn().mockReturnValue({
        push: vi.fn(),
        replace: vi.fn()
      })
    }))
    wrapper = shallowMount(Account)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders account component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  // Split into separate describe blocks to reduce nesting and function length
  describe('Profile Management', () => {
    it('updates user profile', () => {
      wrapper.vm.update_profile(mock_user)
      expect(wrapper.vm.user).toEqual(mock_user)
    })

    it('validates profile data', () => {
      const result = wrapper.vm.validate_profile(mock_user)
      expect(result).toBe(true)
    })

    it('handles invalid profile data', () => {
      const invalid_user = { ...mock_user, email: '' }
      const result = wrapper.vm.validate_profile(invalid_user)
      expect(result).toBe(false)
    })
  })

  describe('Authentication', () => {
    it('handles login', () => {
      wrapper.vm.login(mock_user)
      expect(wrapper.vm.is_authenticated).toBe(true)
    })

    it('handles logout', () => {
      wrapper.vm.logout()
      expect(wrapper.vm.is_authenticated).toBe(false)
    })
  })

  describe('Password Management', () => {
    it('changes password', () => {
      const new_password = 'newPassword123'
      wrapper.vm.change_password(new_password)
      expect(wrapper.vm.password_changed).toBe(true)
    })

    it('validates password strength', () => {
      const strong_password = 'StrongPass123!'
      const result = wrapper.vm.validate_password(strong_password)
      expect(result).toBe(true)
    })
  })

  describe('Account Settings', () => {
    it('updates notification preferences', () => {
      const preferences = { email: true, push: false }
      wrapper.vm.update_notifications(preferences)
      expect(wrapper.vm.notification_settings).toEqual(preferences)
    })

    it('updates privacy settings', () => {
      const settings = { public_profile: false }
      wrapper.vm.update_privacy(settings)
      expect(wrapper.vm.privacy_settings).toEqual(settings)
    })
  })

  describe('Account Deletion', () => {
    it('handles account deletion', () => {
      wrapper.vm.delete_account()
      expect(wrapper.vm.account_deleted).toBe(true)
    })

    it('confirms deletion request', () => {
      const result = wrapper.vm.confirm_deletion()
      expect(result).toBe(true)
    })
  })
})
