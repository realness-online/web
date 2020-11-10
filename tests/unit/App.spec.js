import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'

import * as firebase from 'firebase/app'
import App from '@/App'
describe('@/App.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(App, {
      stubs: ['router-link', 'router-view']
    })
  })
  afterEach(() => {
    firebase.initializeApp.mockClear()
    wrapper.destroy()
  })
  it('Renders layout of the application', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
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
  it('Initialises firebase', () => {
    expect(firebase.initializeApp).toHaveBeenCalledTimes(1)
  })
})
