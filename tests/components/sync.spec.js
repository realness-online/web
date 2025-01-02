import { shallowMount, mount, flushPromises as flush } from '@vue/test-utils'
import { get, set, del } from 'idb-keyval'
import * as itemid from '@/utils/itemid'
import * as sync_worker from '@/use/sync'
import sync from '@/components/sync'
import get_item from '@/utils/item'
import { Me, Statements, Events, Poster } from '@/persistance/Storage'

const fake_props = {
  global: {
    stubs: ['router-link', 'router-view']
  },
  props: { config: {} }
}
const statement = {
  id: '/+16282281824',
  type: 'statements',
  statement: 'I like to move it'
}
let current_user = {
  phoneNumber: '+16282281824'
}
describe('@/components/sync', () => {
  let wrapper
  let person
  beforeEach(async () => {
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+16282281824',
      avatar: '/+16282281824/avatars/1578929551564',
      visited: '2020-03-03T17:37:22.943Z'
    }
    localStorage.me = `/${current_user.phoneNumber}`
    wrapper = shallowMount(sync, {
      mixins: [mixin_mock]
    })
    await flush()
  })
  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    firebase.user = null
  })
  describe('Render', () => {
    it('Renders sync component', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Watchers', () => {
    describe('statement', () => {
      it('Does nothing unless there is a statement', async () => {
        wrapper.setProps({ statement })
        const save_spy = vi.spyOn(Statements.prototype, 'save')
        wrapper.setProps({ statement: null })
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        await wrapper.setProps({ statement })
        await flush()
        expect(wrapper.emitted('update:statement')).toBeTruthy()
      })
    })
    describe('person', () => {
      it('Does nothing unless there is a person', async () => {
        const props = { ...fake_props }
        props.props.person = person
        wrapper = await shallowMount(sync, props)
        wrapper.setProps({ person: null })
        const save_spy = vi.spyOn(Me.prototype, 'save')
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
        expect(save_spy).not.toBeCalled()
      })
      it('Triggered when statement is set', async () => {
        localStorage.sync_time = Date.now()
        const save_spy = vi.spyOn(Me.prototype, 'save')
        wrapper = shallowMount(sync, fake_props)
        await wrapper.setProps({ person })
        await flush()
        expect(save_spy).toBeCalled()
      })
    })
  })
  describe('Methods', () => {
    describe('#visibility_change', () => {
      it('Plays the sync when app becomes visible', async () => {
        // being explicit
        const play = vi
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        Object.defineProperty(window.document, 'visibilityState', {
          enumerable: false,
          configurable: false,
          writable: true,
          value: 'visible'
        })
        await wrapper.vm.play()
        expect(wrapper.vm.play).toBeCalled()
      })
      it('Is chill when the UI is hidden', async () => {
        wrapper = await shallowMount(sync, fake_props)
        wrapper.vm.syncer = {
          postMessage: vi.fn()
        }
        Object.defineProperty(window.document, 'visibilityState', {
          value: 'hidden'
        })
        const play = vi
          .spyOn(wrapper.vm, 'play')
          .mockImplementation(() => Promise.resolve())
        await wrapper.vm.visibility_change()
        expect(document.visibilityState).toBe('hidden')
        expect(play).not.toBeCalled()
      })
    })
    describe('#get_my_itemid', () => {
      it('Returns the user itemid when called without type', async () => {
        expect(localStorage.me).toBe(`/${current_user.phoneNumber}`)
        wrapper = shallowMount(sync, fake_props)
        await flush()
        expect(wrapper.vm.get_my_itemid()).toBe('/+16282281824')
      })
    })
  })
})

current_user = { phoneNumber: '+16282281824' }
describe('@/mixins/visit', () => {
  let wrapper
  let person
  beforeEach(() => {
    firebase.user = current_user
    person = {
      first_name: 'Scott',
      last_name: 'Fryxell',
      id: '/+14151234356',
      avatar: '/+14151234356/avatars/1578929551564',
      visited: '2021-02-04T18:30:01.038Z'
    }
    wrapper = shallowMount(vector_mock)
  })
  afterEach(() => {
    firebase.user = null
  })
  describe('methods', () => {
    describe('#visit', () => {
      it('Exists', () => {
        expect(wrapper.vm.update_visit).toBeDefined()
      })
      it('Updates the user with a visit', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Does nothing unless there is a person', async () => {
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
      it('Waits a proper interval before update to visit', async () => {
        person.visited = new Date().toISOString()
        const load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(person))
        await wrapper.vm.update_visit()
        await flushPromises()
        expect(load_spy).toBeCalled()
        expect(wrapper.emitted('update:person')).not.toBeTruthy()
      })
    })
  })
})
