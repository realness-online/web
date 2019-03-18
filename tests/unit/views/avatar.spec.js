import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import Avatar from '@/views/Avatar'
describe('@/views/Avatar.vue', () => {
  let wrapper
  const $route = {
    params: {}
  }
  beforeEach(() => {
    wrapper = shallow(Avatar, {
      mocks: {
        $route
      }
    })
  })
  describe('displaying an avatar', () => {
    it('renders the silhouette by default', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  it('finished_viewing()', () => {
    const localVue = createLocalVue()
    localVue.use(VueRouter)
    const router = new VueRouter()
    sessionStorage.setItem('previous', '/test_route')
    let wrapper = shallow(Avatar, {
      localVue,
      router
    })
    wrapper.vm.finished_viewing()
    expect(wrapper.vm.$route.path).toBe('/test_route')
    sessionStorage.removeItem('previous')
  })

})
