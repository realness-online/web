import { shallow, createLocalVue } from 'vue-test-utils'
import Item from '@/modules/item'
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
      first_name: 'Scott',
      last_name: 'Fryxell',
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
      let mobile = wrapper.find('.phone')
      expect(mobile.text()).toBe('(628) 228-1824')
    })
    it('should parse mobile number as it\'s typed in', () => {
      person.id = '/+1628'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      let mobile = wrapper.find('a.phone')
      expect(mobile.text()).toBe('(628)')
      person.id = '/+1628228'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      mobile = wrapper.find('a.phone')
      expect(mobile.text()).toBe('(628) 228')
      person.id = '/+162822818'
      wrapper = shallow(as_figure, { propsData: { person: person } })
      mobile = wrapper.find('a.phone')
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
    it('when is_me is true should go to the account page', () => {
      jest.spyOn(Item, 'get_first_item').mockImplementation(() => person)
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
  })
})
