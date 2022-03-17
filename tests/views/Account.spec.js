import { shallowMount, flushPromises } from '@vue/test-utils'
import Account from '@/views/Account'
import * as itemid from '@/use/itemid'
import { current_user } from '@/use/serverless'

const user = {
  phoneNumber: '+16282281824'
}
const me = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
describe('@/views/Account.vue', () => {
  let wrapper, load_spy, list_spy
  beforeEach(async () => {
    current_user.value = user
    localStorage.me = '/+16282281824'
    load_spy = vi
      .spyOn(itemid, 'load')
      .mockImplementation(() => Promise.resolve(me))
    list_spy = vi
      .spyOn(itemid, 'list')
      .mockImplementation(() => Promise.resolve([]))
    wrapper = await shallowMount(Account)
  })
  afterEach(() => {
    localStorage.clear()
    current_user.value = null
  })
  describe('Renders', () => {
    it.only('Account information', async () => {
      await flushPromises()
      expect(load_spy).toBeCalled()
      expect(list_spy).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.statements_id', () => {
      it('Give the current users id', async () => {
        expect(wrapper.vm.statements_id).toBe('/+16282281824/statements')
      })
    })
  })
  describe('Methods', () => {
    let $router
    beforeEach(() => {
      $router = { push: vi.fn() }
      wrapper = shallowMount(Account, {
        global: {
          mocks: { $router }
        }
      })
    })
    describe('#is_editable', () => {
      it('Returns true if statements are the first page', () => {
        const mock_statements = [
          { id: '/+16282281824/statements/1569168047725' },
          { id: '/+16282281824/statements/1569909292018' },
          { id: '/+16282281824/statements/1569909311638' }
        ]
        wrapper.vm.first_page = mock_statements
        expect(wrapper.vm.is_editable(mock_statements)).toBe(true)
      })
      it('Returns false if statements are the another page', () => {
        const mock_statements = [
          { id: '/+16282281824/statements/1569168047725' },
          { id: '/+16282281824/statements/1569909292018' },
          { id: '/+16282281824/statements/1569909311638' }
        ]
        wrapper.vm.first_page = []
        expect(wrapper.vm.is_editable(mock_statements)).toBe(false)
      })
      it('Returns false if the component is working', () => {
        wrapper.vm.working = true
        expect(wrapper.vm.is_editable([])).toBe(false)
      })
    })
    describe('#signoff', () => {
      it('Signs the user out', () => {
        wrapper.vm.signoff()
        expect(signOut).toBeCalled()
        expect($router.push).toHaveBeenCalledTimes(1)
        expect($router.push).toHaveBeenCalledWith({ path: '/sign-on' })
      })
    })
    describe('#home', () => {
      it('Takes the user to the homepage', () => {
        wrapper.vm.home()
        expect($router.push).toHaveBeenCalledTimes(1)
        expect($router.push).toHaveBeenCalledWith({ path: '/' })
      })
    })
    describe('#thought_focused', () => {
      it('Run when an editable statement is focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_focused(statement)
      })
    })
    describe('#thought_blurred', () => {
      it('Run when an editable statement is focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_shown = vi.spyOn(wrapper.vm, 'thought_shown')
        wrapper.vm.thought_shown.mockImplementationOnce(() => true)
        wrapper.vm.currently_focused = statement.id
        wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).toBeCalled()
      })
      it('Only Runs when focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.thought_shown = vi.spyOn(wrapper.vm, 'thought_shown')
        wrapper.vm.thought_shown.mockImplementationOnce(() => true)
        wrapper.vm.currently_focused = '/some/one/else'
        wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).not.toBeCalled()
      })
    })
    describe('#thought_shown', () => {
      const statements = [
        { id: '/+16282281824/statements/1569168047725' },
        { id: '/+16282281824/statements/1569909292018' },
        { id: '/+16282281824/statements/1569909311638' }
      ]
      it("Checks if it's time to load more thoughts", async () => {
        vi.spyOn(itemid, 'as_directory').mockImplementation(() => {
          return { items: ['index', '1569909311638'] }
        })
        wrapper.vm.statements = statements
        await wrapper.vm.thought_shown(statements)
      })
    })
    describe('#slot_key', () => {
      const item = { id: '/+16282281824/statements/1569168047725' }
      it('Determines the slot key of an item', () => {
        const key = wrapper.vm.slot_key(item)
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
      it('Determines the slot key of an array of items', () => {
        const key = wrapper.vm.slot_key([item])
        expect(key).toBe('/+16282281824/statements/1569168047725')
      })
    })
    describe('#get_all_my_stuff', () => {
      it('Handles empty person', () => {
        load_spy = vi
          .spyOn(itemid, 'load')
          .mockImplementation(() => Promise.resolve(null))
        wrapper.vm.get_all_my_stuff()
        expect(load_spy).toBeCalled()
      })
    })
  })
})
