import { shallow, createLocalVue } from 'vue-test-utils'
import Storage from '@/modules/Storage'
import VueRouter from 'vue-router'
import avatar from '@/pages/avatar'
describe('@/pages/avatar.vue', () => {
  let wrapper
  const $route = {
    params: {}
  }
  beforeEach(() => {
    wrapper = shallow(avatar, {
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
    let wrapper = shallow(avatar, {
      localVue,
      router
    })
    wrapper.vm.finished_viewing()
    expect(wrapper.vm.$route.path).toBe('/test_route')
    sessionStorage.removeItem('previous')
  })
  it('open_camera()', () => {
    wrapper.setProps({view_avatar: true})
    let mock_click = jest.fn()
    wrapper.vm.$refs.file_upload.click = mock_click
    wrapper.vm.open_camera()
    expect(mock_click).toBeCalled()
  })
  describe('accept_changes()', () => {
    it('should update the avatar', () => {
      const localVue = createLocalVue()
      localVue.use(VueRouter)
      const router = new VueRouter()
      let wrapper = shallow(avatar, {
        localVue,
        router
      })
      const save_spy = jest.fn(() => Promise.resolve('save_spy'))
      jest.spyOn(Storage.prototype, 'save').mockImplementation(save_spy)
      wrapper.vm.accept_changes()
      expect(save_spy).toBeCalled()
    })
    it('should save person')

    it('should trigger change event on file input', () => {
      wrapper.setProps({view_avatar: true})
      let input = wrapper.find('input[type=file]')
      expect(input.exists()).toBe(true)
      input.element.value = ''
      input.trigger('change')
      // currently no way to test file inputs. let's trigger the event anyway
    })
  })
})
