import { shallow } from 'vue-test-utils'
import Index from '@/views/Index'
import profile_id from '@/modules/profile_id'
import flushPromises from 'flush-promises'
const person = { id: '/+14156667777' }
jest.spyOn(profile_id, 'load').mockImplementation(() => person)

describe('@/views/Index.vue', () => {
  it('Renders navigation for the application', async() => {
    let wrapper = shallow(Index)
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
})
