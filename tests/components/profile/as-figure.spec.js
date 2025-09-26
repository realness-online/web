import { shallowMount } from '@vue/test-utils'
import { get } from 'idb-keyval'
import { vi } from 'vitest'
import as_figure from '@/components/profile/as-figure'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    path: '/test-path'
  })
}))

// Mock the use/people composable
vi.mock('@/use/people', () => ({
  use_me: () => ({
    relations: []
  }),
  is_person: (maybe) => {
    if (typeof maybe !== 'object') return false
    if (maybe.type !== 'person') return false
    if (!maybe.id) return false
    return true
  }
}))
describe('@/component/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    get.mockImplementation(() => Promise.resolve({}))
    localStorage.me = '/+16282281824'
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281823',
      type: 'person'
    }
    wrapper = shallowMount(as_figure, {
      props: {
        person
      },
      global: {
        stubs: {
          'as-svg': true,
          'Icon': true,
          'ProfileAsMeta': true,
          'AsRelationshipOptions': true,
          'AsAddress': true,
          'AsMessenger': true
        }
      }
    })
  })
  describe('Renders', () => {
    it("Render a person's profile info", () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods:', () => {
    describe('#avatar_click', () => {
      it('navigates to person profile when clicked', () => {
        const mockPush = vi.fn()

        // Override the mock for this specific test
        vi.mocked(vi.importMock('vue-router')).useRouter.mockReturnValue({
          push: mockPush
        })

        // Create a fresh wrapper with the new mock
        const testWrapper = shallowMount(as_figure, {
          props: { person },
          global: {
            stubs: {
              'as-svg': true,
              'Icon': true,
              'ProfileAsMeta': true,
              'AsRelationshipOptions': true,
              'AsAddress': true,
              'AsMessenger': true
            }
          }
        })

        // Test the method directly
        testWrapper.vm.avatar_click()
        expect(mockPush).toHaveBeenCalledWith({ path: '/+16282281823' })
      })
    })
  })
})
