import { shallowMount } from '@vue/test-utils'
import firebase from 'firebase/app'
import App from '@/App'
const fetch = require('jest-fetch-mock')
describe('@/App.vue', () => {
  let wrapper
  const node_env = process.env
  beforeEach(async () => {
    jest.resetModules()
    process.env = { ...node_env }
    wrapper = await shallowMount(App, {
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
  })
  afterEach(() => {
    firebase.initializeApp.mockClear()
    wrapper.unmount()
  })
  afterAll(() => {
    process.env = node_env
  })
  describe('Renders', () => {
    it('Layout of the application', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Initialises firebase', () => {
      expect(firebase.initializeApp).toHaveBeenCalled()
    })
    it('Initialises firebase in production', async () => {
      process.env.NODE_ENV = 'production'
      fetch.mockResponseOnce('{}')
      wrapper = await shallowMount(App, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
      expect(firebase.initializeApp).toHaveBeenCalled()
      expect(fetch.mock.calls.length).toBe(1)
      expect(fetch.mock.calls[0][0]).toBe('__/firebase/init.json')
    })
    it('Calls offline is app is initialized offline', async () => {
      jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValueOnce(false)
      wrapper = await shallowMount(App, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
    })
  })
  describe('Methods', () => {
    describe('#onLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: jest.fn() }]
        wrapper.vm.status = 'offline'
        jest.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.online()
        expect(wrapper.vm.status).toBe(null)
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#offLine', () => {
      it('Turns the editable content back on', () => {
        const elements = [{ setAttribute: jest.fn() }]
        wrapper.vm.status = 'offline'
        jest.spyOn(document, 'querySelectorAll').mockReturnValueOnce(elements)
        wrapper.vm.offline()
        expect(wrapper.vm.status).toBe('offline')
        expect(elements[0].setAttribute).toBeCalled()
      })
    })
    describe('#sync_active', () => {
      it('Sets Status to active whebn syncing', () => {
        wrapper.vm.status = 'offline'
        wrapper.vm.sync_active(true)
        expect(wrapper.vm.status).toBe('working')
      })
      it('Sets Status to null when not syncing', () => {
        wrapper.vm.status = 'offline'
        wrapper.vm.sync_active(false)
        expect(wrapper.vm.status).toBe(null)
      })
    })
  })
})
