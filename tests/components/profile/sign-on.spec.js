import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import sign_on from '@/components/profile/sign-on'

const mockPush = vi.fn()

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('@/components/profile/sign-on', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  describe('Renders', () => {
    it('Sign on button', () => {
      const wrapper = shallowMount(sign_on)
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('Methods', () => {
    describe('#sign_on', () => {
      it('Takes you to the sign-on page when clicked', async () => {
        const wrapper = shallowMount(sign_on)
        await wrapper.find('button').trigger('click')
        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith({ path: '/sign-on' })
      })
    })
  })
})
