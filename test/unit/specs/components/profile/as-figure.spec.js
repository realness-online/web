import {shallow} from 'vue-test-utils'
import as_figure from '@/components/profile/as-figure'

describe('@/compontent/profile/as-figure.vue', () => {
  let person, wrapper
  beforeEach(() => {
    person = {
      created_at: '2018-07-15T18:11:31.018Z',
      updated_at: '2018-07-16T18:12:21.552Z',
      image: '/people/+16282281824/profile.svg',
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
})
