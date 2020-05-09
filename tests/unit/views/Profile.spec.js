import { shallow } from 'vue-test-utils'
import Profile from '@/views/Profile'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const fetch = require('jest-fetch-mock')

describe('@/views/Profile.vue', () => {
  it('Shows profile information for a phone number', async () => {
    fetch.resetMocks()
    fetch.mockResponseOnce(person)
    const $route = { params: { phone_number: '+14151231234' } }
    const wrapper = shallow(Profile, { mocks: { $route } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
  })
})
