import { shallow } from 'vue-test-utils'
import avatar from '@/pages/avatar'

describe('@/pages/avatar.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(avatar)
  })
  it('displays the silhouette by default', () => {
    expect(wrapper.element).toMatchSnapshot()
  })

  describe('uploading an avatar', () => {
    it('displays the form for a person visiting their own avatar')
    it('click@decline closes the form without saving the avatar')
    it('click@open_camera opens the camera', () => {
      wrapper.setProps({edit_avatar: true})
      let mock_click = jest.fn()
      wrapper.vm.$refs.file_upload.click = mock_click
      wrapper.vm.open_camera()
      expect(mock_click).toBeCalled()
    })
    it('change event should get input file', () => {
      wrapper.setProps({edit_avatar: true})
      let input = wrapper.find('input[type=file]')
      expect(input.exists()).toBe(true)
      input.element.value = ''
      input.trigger('change')
      // currently no way to test file inputs. let's trigger the event anyway
    })
  })
})
