import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
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
      stubs: ['router-link', 'router-view']
    })
  })
  afterEach(() => {
    firebase.initializeApp.mockClear()
    wrapper.unmounted()
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
      wrapper = await shallowMount(App, { stubs: ['router-link', 'router-view'] })
      expect(firebase.initializeApp).toHaveBeenCalled()
      expect(fetch.mock.calls.length).toBe(1)
      expect(fetch.mock.calls[0][0]).toBe('__/firebase/init.json')
    })
    it('Calls offline is app is initialized offline', async () => {
      jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValueOnce(false)
      wrapper = await shallowMount(App, { stubs: ['router-link', 'router-view'] })
    })
  })
  describe('Routing', () => {
    it('Sets previously visited page in sessionStorage', async () => {
      const localVue = createLocalVue()
      localVue.use(VueRouter)
      const router = new VueRouter({
        routes: [
          { path: '/relations', name: 'relations' },
          { path: '/magic', name: 'magic' }
        ]
      })
      wrapper = shallowMount(App, { localVue, router })
      await router.push({ name: 'relations' })
      await router.push({ name: 'magic' })
      expect(sessionStorage.previous).toBe('/relations')
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
