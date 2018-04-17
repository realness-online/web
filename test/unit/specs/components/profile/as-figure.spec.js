import {shallow} from 'vue-test-utils'
import as_figure from '@/components/profile/as-figure'

describe('as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    person = {
      profile_vector: '/people/scott-fryxell/profile.svg',
      first_name: 'scott',
      last_name: 'fryxell',
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
})
