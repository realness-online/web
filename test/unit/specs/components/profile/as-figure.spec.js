import {shallow} from 'vue-test-utils'
import as_figure from '@/components/profile/as-figure'

describe('as-figure.vue', () => {

  it('should render user profile info', () => {
    const person = {
      profile_vector: '/people/scott-fryxell/profile.svg',
      first_name: 'scott',
      last_name: 'fryxell',
      profile_name: 'oingo'
    }

    let wrapper = shallow(as_figure, {
      propsData: {
        person: person
      }
    })
    expect(wrapper.element).toMatchSnapshot()

    person.profile_name = ""
    wrapper.setProps({person:person})
  })

  

})
