import { shallow, createLocalVue } from 'vue-test-utils'
import VueRouter from 'vue-router'
import Storage from '@/modules/Storage'
import as_figure from '@/components/profile/as-figure'
describe('@/compontent/profile/as-figure.vue', () => {
  const avatar_mock = `<symbol id="#avatar_6282281824" viewBox="0 0 192 192">
    <rect id="top-bun" x="0" y="0" width="192" height="32" rx="8"></rect>
    <rect id="patty" x="0" y="80" width="192" height="32" rx="8"></rect>
    <rect id="bottom-bun" x="0" y="160" width="192" height="32" rx="8"></rect>
  </symbol>`
  let person, wrapper
  beforeEach(() => {
    person = {
      created_at: '2018-07-15T18:11:31.018Z',
      updated_at: '2018-07-16T18:12:21.552Z',
      image: '/people/+16282281824/avatar.svg',
      first_name: 'Scott',
      last_name: 'Fryxell',
      mobile: '6282281824',
      id: '/+16282281824'
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
  describe('mobile number', () => {
    it('should format the mobile number for display', () => {
      let mobile = wrapper.find('[itemprop=mobile]')
      expect(mobile.text()).toBe('(628) 228-1824')
    })
    it('should parse mobile number as it\'s typed in', () => {
      person.mobile = '628'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      let mobile = wrapper.find('[itemprop=mobile]')
      expect(mobile.text()).toBe('(628)')
      person.mobile = '628228'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      mobile = wrapper.find('[itemprop=mobile]')
      expect(mobile.text()).toBe('(628) 228')
      person.mobile = '62822818'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      mobile = wrapper.find('[itemprop=mobile]')
      expect(mobile.text()).toBe('(628) 228-18')
    })
  })
  describe('rendering avatar', () => {
    it('should render the users avatar', () => {
      let avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).toBeFalsy()
      person.avatar = avatar_mock
      wrapper.setProps({ person: person })
      avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).not.toBeTruthy()
    })
  })
  describe('svg.avatar@click', () => {
    let router
    beforeEach(() => {
      const localVue = createLocalVue()
      localVue.use(VueRouter)
      router = new VueRouter()
      wrapper = shallow(as_figure, {
        localVue,
        router,
        propsData: {
          person: person
        }
      })
    })
    it('should go to the mobile number when clicked', () => {
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/+16282281824')
    })
    it('when click_to_avatar is true it should go to the users avatar page', () => {
      wrapper.setProps({ click_to_avatar: true })
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/+16282281824/avatar')
    })
    it('when is_me is true should go to the account page', () => {
      jest.spyOn(Storage.prototype, 'as_object').mockImplementation(() => person)
      wrapper.setProps({ person: person })
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/account')
    })
    it('when previous is true should go to the previous page', () => {
      sessionStorage.setItem('previous', '/test-route')
      wrapper.setProps({ previous: true })
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/test-route')
      sessionStorage.removeItem('previous')
    })
    it('just display the avatar when just_display_avatar is true', () => {
      var push_spy = jest.fn()
      router.push = push_spy
      wrapper.setProps({ just_display_avatar: true })
      wrapper.vm.avatar_click()
      expect(push_spy).not.toBeCalled()
    })
  })
})
