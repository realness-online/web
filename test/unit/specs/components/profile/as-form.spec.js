import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'

describe('as-form.vue', () => {
  it('should render form to set user profile info', () => {
    const person = {
      profile_vector: '/people/scott-fryxell/profile.svg',
      first_name: 'Scott',
      last_name: 'Fryxell',
      profile_name: 'oingo'
    }
    let wrapper = shallow(as_form, { propsData: { person: person } })
    expect(wrapper.element).toMatchSnapshot()
  })

  describe("#mobile", () =>{
    it('should only allow number to be entered')
    it('should only allow number to be pasted in')
    it('should validate that the user provided a mobile number', () => {
      // <a href="tel:+13174562564">
    })
    it('sign the user in with their phone number', () => {
      expect(true).toBe(false)
    })
  })

  it('should validate that the @username is not taken')
  it('should only allow lower case text, numbers, dashes, and underscores')
})
