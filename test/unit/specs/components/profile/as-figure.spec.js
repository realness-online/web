import {shallow, createLocalVue} from 'vue-test-utils'
import VueRouter from 'vue-router'
import as_figure from '@/components/profile/as-figure'


describe('@/compontent/profile/as-figure.vue', () => {
  let person, wrapper, $route
  beforeEach(() => {

    person = {
      created_at: '2018-07-15T18:11:31.018Z',
      updated_at: '2018-07-16T18:12:21.552Z',
      image: '/people/+16282281824/avatar.svg',
      first_name: 'Scott',
      last_name: 'Fryxell',
      mobile: '6282281824'
    }
    wrapper = shallow(as_figure, {
      propsData: {
        person: person
      }
    })
  })
  it('should render user profile info', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should render default icon', () => {
    person.image = null
    wrapper = shallow(as_figure, {
      propsData: {
        person: person
      }
    })
    expect(wrapper.element).toMatchSnapshot()
  })
  it('should format the mobile number for display', () => {
    let mobile = wrapper.find('[itemprop=mobile]')
    expect(mobile.text()).toBe('(628) 228-1824')
  })
  it('should parse mobile number as it\'s typed in', () => {
    person.mobile = '628'
    wrapper = shallow(as_figure, {propsData: {person: person}})
    let mobile = wrapper.find('[itemprop=mobile]')
    expect(mobile.text()).toBe('(628)')
    person.mobile = '628228'
    wrapper = shallow(as_figure, {propsData: {person: person}})
    mobile = wrapper.find('[itemprop=mobile]')
    expect(mobile.text()).toBe('(628) 228')
    person.mobile = '62822818'
    wrapper = shallow(as_figure, {propsData: {person: person}})
    mobile = wrapper.find('[itemprop=mobile]')
    expect(mobile.text()).toBe('(628) 228-18')
  })
  describe('#avatar_click', () => {
    beforeEach(() => {
      const localVue = createLocalVue()
      localVue.use(VueRouter)
      const router = new VueRouter()
      wrapper = shallow(as_figure, {
        localVue,
        router,
        propsData: {
          person: person
        }
      })
    })

    it.only('should go to the mobile number when clicked', () => {
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/+16282281824')
    })
    it.only('should go to the account page when me is true', () => {
      wrapper.setProps({me: true})
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/account')
    })
    it.only('should go to the previous page when previous is true', () => {
      sessionStorage.setItem('previous', '/test-route')
      wrapper.setProps({previous: true})
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/test-route')
    })
    it.only('should execute file upload when clicked from account page', () => {
      wrapper.setProps({edit_avatar: true})
      const input = wrapper.find('#avatar_picker')
      let mock_click = jest.fn()
      wrapper.vm.$refs.file_upload.click = mock_click
      console.log(wrapper.vm.$refs.file_upload);
      wrapper.vm.avatar_click()
      expect(mock_click).toBeCalled()
    })
  })
})
