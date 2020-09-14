import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import Navigation from '@/views/Navigation'
import itemid from '@/helpers/itemid'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+14151234356'
}
const statement = {
  id: '/+14151234356/statements/1588445514928',
  statement: 'I like to move it'
}
describe('@/views/Navigation.vue', () => {
  let wrapper
  beforeEach(async () => {
    jest.spyOn(itemid, 'load').mockImplementation(_ => person)
    wrapper = shallow(Navigation)
    wrapper.setData({ version: '1.0.0' })
    await flushPromises()
  })
  afterEach(() => {
    wrapper.destroy()
  })
  it('Renders statements and profile for a person', async () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  describe('navigating the application', () => {
    describe('handling statement events', () => {
      it('posting:false should render the main navigation', () => {
        expect(wrapper.vm.posting).toBe(false)
        expect(wrapper.element).toMatchSnapshot()
      })
      it('posting:true should hide main navigation', () => {
        wrapper.setData({ posting: true })
        expect(wrapper.element).toMatchSnapshot()
      })
    })
    describe('#user_name', () => {
      it('Returns \'You\' by default', async () => {
        jest.spyOn(itemid, 'load').mockImplementationOnce(_ => null)
        wrapper = shallow(Navigation)
        await flushPromises()
        expect(wrapper.vm.first_name).toBe('You')
      })
      it('Returns the users first name if set', () => {
        expect(wrapper.vm.first_name).toBe('Scott')
      })
    })
  })
})
