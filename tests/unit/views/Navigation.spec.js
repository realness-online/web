import { shallow } from 'vue-test-utils'
import flushPromises from 'flush-promises'
import Navigation from '@/views/Navigation'
import itemid from '@/helpers/itemid'
// const six_minutes_ago = Date.now() - (1000 * 60 * 6)
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
    jest.spyOn(itemid, 'load').mockImplementation(() => person)
    jest.spyOn(itemid, 'list').mockImplementationOnce(() => [statement])
    jest.spyOn(itemid, 'list').mockImplementationOnce(() => [person])
    wrapper = shallow(Navigation)
    wrapper.setData({ version: '1.0.0' })
    await flushPromises()
  })
  afterEach(() => {
    wrapper.destroy()
  })
  it('Renders statements and profile for a person', async () => {
    expect(wrapper.element).toMatchSnapshot()
    expect(wrapper.find('[itemprop=statements]')).toBeTruthy()
    expect(wrapper.find('[itemref="profile"]')).toBeTruthy()
  })
  it('Add a statement when statement-added is emited', async () => {
    expect(wrapper.vm.statements.length).toBe(1)
    wrapper.vm.$emit('statement-added', statement)
    await flushPromises()
    wrapper.vm.add_statement(statement)
    expect(wrapper.vm.statements.length).toBe(2)
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
        jest.spyOn(itemid, 'load').mockImplementationOnce(() => null)
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
