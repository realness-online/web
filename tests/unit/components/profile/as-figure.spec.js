import { shallow, createLocalVue } from 'vue-test-utils'
import get_item from '@/modules/item'
import VueRouter from 'vue-router'
import as_figure from '@/components/profile/as-figure'
const fs = require('fs')
const avatar_mock = fs.readFileSync('./tests/unit/html/avatar.html', 'utf8')
describe ('@/compontent/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    person = {
      created_at: '2018-07-15T18:11:31.018Z',
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281823'
    }
    wrapper = shallow(as_figure, {
      propsData: {
        person: person
      }
    })
  })
  it ('Render a person\'s profile info', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe ('mobile number', () => {
    it ('Format the mobile number for display', () => {
      const mobile = wrapper.find('.phone')
      expect(mobile.text()).toBe('(628) 228-1823')
    })
    it ('Parse mobile number as it\'s typed in', () => {
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
  describe ('rendering avatar', () => {
    it ('Render the users avatar', () => {
      let avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).toBeFalsy()
      person.avatar = avatar_mock
      wrapper.setProps({ person: person })
      avatar = wrapper.find('[itemprop=avatar]')
      expect(avatar.empty).not.toBeTruthy()
    })
  })
  describe ('svg.avatar@click', () => {
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
    it ('Go to the mobile number when clicked', () => {
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/+16282281823')
    })
    it ('When is_me is true should go to the account page', () => {
      jest.spyOn(Item, 'get_first_item').mockImplementation(() => person)
      wrapper.setProps({ person: person })
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/account')
    })
    it ('When previous is true should go to the previous page', () => {
      sessionStorage.setItem('previous', '/test-route')
      wrapper.setProps({ previous: true })
      wrapper.vm.avatar_click()
      expect(wrapper.vm.$route.path).toBe('/test-route')
      sessionStorage.removeItem('previous')
    })
  })
})
