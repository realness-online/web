import { shallowMount, flushPromises as flush } from '@vue/test-utils'
import * as itemid from '@/use/itemid'
import { clear } from 'idb-keyval'
import Sign_on from '@/views/Sign-on'
const person = {
  id: '/+14151234356',
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}
vi.mock('vue-router')
describe('@/views/Sign-on.vue', () => {
  let wrapper
  beforeEach(async () => {
    localStorage.me = '/+'
    wrapper = shallowMount(Sign_on, {
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
    await flush()
  })
  afterEach(() => {
    wrapper = null
    localStorage.clear()
    vi.clearAllMocks()
  })
  describe('Renders', () => {
    it('Renders a form for a new user', async () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('Renders a form for a returning user', async () => {
      localStorage.me = '/+6282281823'
      vi.spyOn(itemid, 'load').mockImplementation(() => {
        return Promise.resolve(person)
      })
      wrapper = shallowMount(Sign_on)
      await flush()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe.skip('.cleanable', () => {
      it('Is cleanable if they are signed out', () => {
        wrapper.vm.current_user = true
        expect(wrapper.vm.cleanable).toBe(false)
      })
      it('Is cleanable if me is defined', async () => {
        localStorage.me = '/+1628228184'
        expect(wrapper.vm.cleanable).toBe(true)
      })
      it('Is cleanable if there are a couple items in localStorage', async () => {
        localStorage.statements = 'some statements would be here'
        localStorage.person = 'a profile would be here'
        expect(wrapper.vm.cleanable).toBe(true)
      })
      it('Is cleanable is there are items in local database', () => {
        wrapper.vm.index_db_keys = ['/a/key']
        expect(wrapper.vm.cleanable).toBe(true)
      })
    })
  })
  describe('Methods', () => {
    describe('#signed_on', () => {
      it('Loads the profile', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.signed_on()
        expect(load_spy).toBeCalled()
        expect(wrapper.vm.nameless).toBe(false)
        expect(wrapper.vm.router.push).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.router.push).toHaveBeenCalledWith({ path: '/' })
      })
      it('Sets nameless to true if no profile is found', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        await wrapper.vm.signed_on()
        expect(load_spy).toBeCalled()
        expect(wrapper.vm.nameless).toBe(true)
      })
    })
    describe('#new_person', () => {
      it('Takes them to the account page', async () => {
        await wrapper.vm.new_person()
        expect(wrapper.vm.person.visited).toBeTruthy()
        expect(wrapper.vm.router.push).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.router.push).toHaveBeenCalledWith({
          path: '/account'
        })
      })
    })
    describe('#clean', () => {
      it('Wipes out the local storage', async () => {
        const local_clear_spy = vi.spyOn(localStorage, 'clear')
        await wrapper.vm.clean()
        expect(local_clear_spy).toBeCalled()
        expect(clear).toBeCalled()
        expect(localStorage.me).toBe('/+')
        expect(wrapper.vm.router.push).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.router.push).toHaveBeenCalledWith({ path: '/' })
      })
    })
  })
})
