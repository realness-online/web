import { shallow } from 'vue-test-utils'
import Profile from '@/views/Profile'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')

describe('@/views/Profile.vue', () => {
  fetch.mockResponseOnce(person)
  it('Shows profile information for a phone number', async() => {
    const $route = { params: { phone_number: '+14151231234' } }
    let wrapper = shallow(Profile, { mocks: { $route } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
})
