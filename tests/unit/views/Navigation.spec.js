import { shallow } from 'vue-test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import flushPromises from 'flush-promises'
import Navigation from '@/views/Navigation'
import itemid from '@/helpers/itemid'
const six_minutes_ago = Date.now() - (1000 * 60 * 6)
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const statement = {
  id: '/+14151234356/statements/1588445514928',
  statement: 'I like to move it'
}
describe ('@/views/Navigation.vue', () => {
  let wrapper
  beforeEach(async () => {
    jest.spyOn(itemid, 'load').mockImplementation(() => person)
    wrapper = shallow(Navigation)
    wrapper.setData({ version: '1.0.0' })
    await flushPromises()
  })
  afterEach(() => {
    wrapper.destroy()
  })
  it ('Renders statments and profile for a person', async () => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=statements]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
  it ('Add a statement when statement-added is emited', async () => {
    expect(wrapper.vm.days.size).toBe(0)
    wrapper.vm.$emit('statement-added', statement)
    await flushPromises()
    wrapper.vm.add_statement(statement)
    expect(wrapper.vm.days.size).toBe(1)
    expect(wrapper.find('ol')).toBeTruthy()
  })
  describe ('navigating the application', () => {
    describe ('handling statement events', () => {
      it ('posting:false should render the main navigation', () => {
        expect(wrapper.vm.posting).toBe(false)
        expect(wrapper.element).toMatchSnapshot()
      })
      it ('posting:true should hide main navigation', () => {
        wrapper.setData({ posting: true })
        expect(wrapper.element).toMatchSnapshot()
      })
      it ('statement-added event should set has_statements to true', () => {
        expect(wrapper.vm.has_statements).toBe(false)
        wrapper.vm.add_statements(statement)
        expect(wrapper.vm.has_statements).toBe(true)
      })
    })
    describe ('onBoarding()', () => {
      describe ('signed out', () => {
        it ('textarea is the only navigation element to start', () => {
          const signed_out = jest.fn(state_changed => {
            state_changed(null)
          })
          jest.spyOn(firebase, 'auth').mockImplementationOnce(() => {
            return { onAuthStateChanged: signed_out }
          })
          wrapper = shallow(Navigation)
          expect(wrapper.vm.onboarding['has-statements']).toBeFalsy()
          expect(wrapper.vm.onboarding['signed-in']).toBeFalsy()
          expect(wrapper.vm.onboarding['has-friends']).toBeFalsy()
        })
        it ('Profile button is visible when person has posted', () => {
          jest.spyOn(itemid, 'list').mockImplementation(() => {
            return [statement]
          })
          const wrapper = shallow(Navigation)
          expect(wrapper.vm.onboarding['has-statements']).toBe(true)
        })
      })
      describe ('signed in', () => {
        it ('Relations is visible', () => {
          wrapper = shallow(Navigation)
          expect(wrapper.vm.onboarding['signed-in']).toBe(true)
        })
        it ('Feed, Events and posters are visible when person has added a friend', () => {
          jest.spyOn(itemid, 'load').mockImplementation(() => {
            return { statements: [statement] }
          })
          wrapper = shallow(Navigation)
          expect(wrapper.vm.onboarding['has-friends']).toBe(true)
        })
      })
    })
    describe ('#user_name', () => {
      it ('Returns \'You\' by default', () => {
        wrapper.vm.me = {}
        expect(wrapper.vm.user_name).toBe('You')
      })
      it ('Returns the users first name if set', () => {
        expect(wrapper.vm.user_name).toBe('Scott')
      })
    })
  })
})
