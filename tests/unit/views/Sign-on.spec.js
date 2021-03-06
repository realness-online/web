import { shallowMount, createLocalVue } from '@vue/test-utils'
import VueRouter from 'vue-router'
import * as itemid from '@/helpers/itemid'
import { clear } from 'idb-keyval'
import Sign_on from '@/views/Sign-on'
const person = {
  id: '/+14151234356',
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}
describe('@/views/Sign-on.vue', () => {
  let wrapper
  let router
  let localVue
  beforeEach(async () => {
    localStorage.me = '/+'
    localVue = createLocalVue()
    localVue.use(VueRouter)
    router = new VueRouter({
      routes: [
        { path: '/', name: 'home' },
        { path: '/signon', name: 'signon' },
        { path: '/account', name: 'account' }
      ]
    })
    wrapper = await shallowMount(Sign_on, { localVue, router })
  })
  afterEach(() => {
    wrapper = null
    localStorage.clear()
    jest.clearAllMocks()
  })
  describe('Renders', () => {
    it('Renders a form for a new user', async () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Renders a form for a returning user', async () => {
      localStorage.me = '/+6282281823'
      jest.spyOn(itemid, 'load').mockImplementation(itemid => {
        return Promise.resolve(person)
      })
      wrapper = await shallowMount(Sign_on)
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.cleanable', () => {
      it('Is cleanable if they are signed out', () => {
        wrapper.vm.signed_in = true
        expect(wrapper.vm.cleanable).toBe(false)
      })
      it('Is cleanable if me is defined', async () => {
        localStorage.me = '/+1628228184'
        wrapper = await shallowMount(Sign_on, { localVue, router })
        expect(wrapper.vm.cleanable).toBe(true)
      })
      it('Is cleanable if there are a couple items in localStorage', async () => {
        localStorage.statements = 'some statements would be here'
        localStorage.person = 'a profile would be here'
        wrapper = await shallowMount(Sign_on, { localVue, router })
        expect(wrapper.vm.cleanable).toBe(true)
      })
      it('Is cleanable is there are items in local database', () => {
        wrapper.vm.index_db_keys = ['/a/key']
        expect(wrapper.vm.cleanable).toBe(true)
      })
    })
  })
  describe('Methods', () => {
    describe('#auth_state', () => {
      it('Sets mobile to null if the user is signed in', () => {
        wrapper.vm.person = { mobile: '1112223333' }
        wrapper.vm.auth_state({ phoneMumber: '+16282281824' })
        expect(wrapper.vm.person.mobile).toBe(null)
      })
    })
    describe('#signed_on', () => {
      it('Loads the profile', async () => {
        wrapper.vm.$router.push({ path: 'sign-on' })
        const load_spy = jest.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.signed_on()
        expect(load_spy).toBeCalled()
        expect(wrapper.vm.$route.path).toBe('/')
      })
      it('Sets nameless to true if no profile is found', async () => {
        wrapper.vm.$router.push({ path: 'sign-on' })
        const load_spy = jest.spyOn(itemid, 'load').mockImplementation(() => Promise.resolve(null))
        await wrapper.vm.signed_on()
        expect(load_spy).toBeCalled()
        expect(wrapper.vm.nameless).toBe(true)
        expect(wrapper.vm.$route.path).toBe('/sign-on')
      })
      })
    describe('#new_person', () => {
      it('Takes them to the account page', async () => {
        await wrapper.vm.new_person()
        expect(wrapper.vm.person.visited).toBeTruthy()
        expect(wrapper.vm.$route.path).toBe('/account')
      })
    })
    describe('#clean', () => {
      it('Wipes out the local storage', async () => {
        const local_clear_spy = jest.spyOn(localStorage, 'clear')
        await wrapper.vm.clean()
        expect(local_clear_spy).toBeCalled()
        expect(clear).toBeCalled()
        expect(localStorage.me).toBe('/+')
        expect(wrapper.vm.$route.path).toBe('/')
      })
    })
  })
})
