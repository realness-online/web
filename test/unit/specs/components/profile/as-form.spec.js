import {shallow} from 'vue-test-utils'
import as_form from '@/components/profile/as-form'

describe('as-form.vue', () => {
  it('should render form to set user profile info', () => {
    const person = {
      profile_vector: '/people/scott-fryxell/profile.svg',
      first_name: 'scott',
      last_name: 'fryxell',
      profile_name: 'oingo'
    }
    let wrapper = shallow(as_form, { propsData: { person: person } })
    expect(wrapper.element).toMatchSnapshot()
  })
})
