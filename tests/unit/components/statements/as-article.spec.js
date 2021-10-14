import { shallowMount } from '@vue/test-utils'
import flushPromises from 'flush-promises'
import as_article from '@/components/statements/as-article'
const statement = {
  statement: 'I am saying it',
  id: '/+14151234356/statements/1557614404580'
}
const older_statement = {
  statement: 'I can say all the stuff',
  id: '/+14151234356/statements/1553460776031'
}
describe('@/components/statements/as-article.vue', () => {
  let wrapper
  beforeEach(async () => {
    wrapper = await shallowMount(as_article, {
      global: { stubs: ['router-link', 'router-view'] },
      props: { statements: [statement, older_statement] }
    })
    await flushPromises()
  })
  describe('Renders', () => {
    it('Render a statement as an article element', async () => {
      expect(wrapper.element).toMatchSnapshot()
      wrapper.unmount()
    })
    it('Loads the statement author if verbose is true', async () => {
      wrapper = await shallowMount(as_article, {
        global: { stubs: ['router-link', 'router-view'] },
        props: {
          verbose: true,
          statements: [statement, older_statement]
        }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#show', () => {
      it('Emits and event', () => {
        wrapper.vm.show()
        expect(wrapper.emitted('show')).toBeTruthy()
      })
    })
    describe('#has_focus', () => {
      it('Sets focus to true', () => {
        expect(wrapper.vm.focused).toBe(false)
        wrapper.vm.has_focus()
        expect(wrapper.vm.focused).toBe(true)
      })
      it('Emits focused event', () => {
        wrapper.vm.has_focus()
        expect(wrapper.emitted('focused')).toBeTruthy()
      })
    })
    describe('#has_blurred', () => {
      it('Sets focus to false', () => {
        wrapper.vm.focused = true
        wrapper.vm.has_blurred()
        expect(wrapper.vm.focused).toBe(false)
      })
      it('Emits blurred event', async () => {
        jest.useFakeTimers()
        await wrapper.vm.has_blurred()
        await wrapper.vm.$nextTick()
        jest.runAllTimers()
        expect(wrapper.emitted('blurred')).toBeTruthy()
      })
      it('Only emits blurred event whenb focused is lost', async () => {
        await wrapper.vm.has_blurred()
        await wrapper.vm.$nextTick()
        wrapper.vm.focused = true
        jest.runAllTimers()
        expect(wrapper.emitted('blurred')).not.toBeTruthy()
      })
    })
  })
})
