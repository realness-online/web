import { mount, flushPromises } from '@vue/test-utils'
import Account from '@/views/Account'
import { current_user } from '@/use/serverless'
import { signOut } from 'firebase/auth'
import { describe, expect } from 'vitest'
import { ref } from 'vue'
const user = {
  phoneNumber: '+16282281824'
}
const me = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824'
}
vi.mock('vue-router')
vi.mock('@/use/statements', () => ({
  use: () => ({
    for_person: vi.fn(),
    statements: ref([]),
    thought_shown: vi.fn()
  })
}))
describe('@/views/Account.vue', () => {
  let wrapper
  beforeEach(async () => {
    current_user.value = user
    localStorage.me = '/+16282281824'
    const router = { push: vi.fn() }
    wrapper = mount(Account, {
      global: {
        stubs: ['router-link', 'router-view']
      }
    })
    await flushPromises()
  })
  afterEach(() => {
    localStorage.me = undefined
    current_user.value = null
  })
  describe('Renders', () => {
    it('Account information', async () => {
      expect(wrapper.vm.statements_for_person).toBeCalled()
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    beforeEach(async () => {
      wrapper = mount(Account, {
        global: {
          stubs: ['router-link', 'router-view']
        }
      })
      await flushPromises()
    })
    describe('#is_editable', () => {
      it('Returns true if statements are the first page', () => {
        const mock_statements = [
          { id: '/+16282281824/statements/1569168047725' },
          { id: '/+16282281824/statements/1569909292018' },
          { id: '/+16282281824/statements/1569909311638' }
        ]
        wrapper.vm.first_page = mock_statements
        expect(wrapper.vm.working).toBe(false)
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
        expect(wrapper.vm.router.push).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.router.push).toHaveBeenCalledWith({
          path: '/sign-on'
        })
      })
    })
    describe('#home', () => {
      it('Takes the user to the homepage', () => {
        wrapper.vm.home()
        expect(wrapper.vm.router.push).toHaveBeenCalledTimes(1)
        expect(wrapper.vm.router.push).toHaveBeenCalledWith({ path: '/' })
      })
    })
    describe('#thought_focused', () => {
      const id = '/+16282281824/statements/1569168047725'
      it('Tracks the statement that is being edited', () => {
        const statement = { id }
        wrapper.vm.thought_focused(statement)
        expect(wrapper.vm.currently_focused).toBe(id)
      })
      it('Sets the pages of statements viewed back to the default', () => {
        const statement = { id }
        wrapper.vm.thought_focused(statement)
        expect(wrapper.vm.pages_viewed.length).toBe(1)
        expect(wrapper.vm.pages_viewed[0]).toBe('index')
      })
    })
    describe('#thought_blurred', async () => {
      it('Run when an editable statement is focused', async () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.currently_focused = statement.id
        await wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).toBeCalled()
      })
      it('Only Runs when focused', () => {
        const statement = { id: '/+16282281824/statements/1569168047725' }
        wrapper.vm.currently_focused = '/some/one/else'
        wrapper.vm.thought_blurred(statement)
        expect(wrapper.vm.thought_shown).not.toBeCalled()
      })
    })
  })
})
