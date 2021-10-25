import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import 'firebase/auth'
import Profile from '@/views/Profile'
import flushPromises from 'flush-promises'
import * as itemid from '@/helpers/itemid'
const person = require('fs').readFileSync('./tests/unit/html/person.html', 'utf8')
const fetch = require('jest-fetch-mock')
const user = { phoneNumber: '/+16282281824' }

describe('@/views/Profile.vue', () => {
  describe('Renders', () => {
    it('Shows profile information for a phone number', async () => {
      firebase.user = user
      fetch.resetMocks()
      fetch.mockResponseOnce(person)
      jest.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return { items: ['559666932867'] }
      })
      const $route = { params: { phone_number: '+14151231234' } }
      const wrapper = shallowMount(Profile, { global: { mocks: { $route } } })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
    it('Handles there not being posters', async () => {
      firebase.user = user
      fetch.resetMocks()
      fetch.mockResponseOnce(person)
      jest.spyOn(itemid, 'as_directory').mockImplementationOnce(() => {
        return { items: [] }
      })
      const $route = { params: { phone_number: '+14151231234' } }
      const wrapper = shallowMount(Profile, { global: { mocks: { $route } } })
      await flushPromises()
      expect(wrapper.element).toMatchSnapshot()
      firebase.user = null
    })
  })
})
