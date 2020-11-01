import { shallowMount } from '@vue/test-utils'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import Profile from '@/views/Profile'
import flushPromises from 'flush-promises'
const fs = require('fs')
const person = fs.readFileSync('./tests/unit/html/person.html', 'utf8')
const fetch = require('jest-fetch-mock')
const user = { phoneNumber: '/+16282281824' }

describe('@/views/Profile.vue', () => {
  it('Shows profile information for a phone number', async () => {
    firebase.user = user
    fetch.resetMocks()
    fetch.mockResponseOnce(person)
    const $route = { params: { phone_number: '+14151231234' } }
    const wrapper = shallowMount(Profile, { mocks: { $route } })
    await flushPromises()
    expect(wrapper.element).toMatchSnapshot()
    firebase.user = null
  })
})
