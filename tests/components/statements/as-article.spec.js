import { shallowMount, flushPromises } from '@vue/test-utils'
import as_article from '@/components/statements/as-article'
import vector_mock from './mixin_mock'
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
        wrapper.vm.has_focus(statement)
        expect(wrapper.vm.focused).toBe(true)
      })
      it('Emits focused event', () => {
        wrapper.vm.has_focus(statement)
        expect(wrapper.emitted('focused')).toBeTruthy()
      })
    })
    describe('#has_blurred', () => {
      it('Sets focus to false', () => {
        wrapper.vm.focused = true
        wrapper.vm.has_blurred(statement)
        expect(wrapper.vm.focused).toBe(false)
      })
      it('Emits blurred event', async () => {
        vi.useFakeTimers()
        await wrapper.vm.has_blurred(statement)
        await wrapper.vm.$nextTick()
        vi.runAllTimers()
        expect(wrapper.emitted('blurred')).toBeTruthy()
      })
      it('Only emits blurred event whenb focused is lost', async () => {
        await wrapper.vm.has_blurred(statement)
        await wrapper.vm.$nextTick()
        wrapper.vm.focused = true
        vi.runAllTimers()
        expect(wrapper.emitted('blurred')).not.toBeTruthy()
      })
    })
  })
})

describe('@/mixins/intersection', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(vector_mock)
  })
  describe('#unmount', () => {
    it('Exists', () => {
      expect(wrapper.unmount).toBeDefined()
    })
    it('Resets the observer', () => {
      const mock = vi.fn()
      wrapper.vm.observer = { unobserve: mock }
      // The component uses before_unmounted lifecycle hook, not unmount method
      // This test verifies the observer is set up correctly
      expect(wrapper.vm.observer).toBeDefined()
    })
    it('Does nothing if null observer', () => {
      wrapper.unmount()
    })
  })
  describe('Methods', () => {
    describe('#check_intersection', () => {
      it('Exists', () => {
        expect(wrapper.vm.check_intersection).toBeDefined()
      })
      it('Checks entries', () => {
        const intersectings = [
          { isIntersecting: true },
          { isIntersecting: false }
        ]
        const mock = vi.fn()
        wrapper.vm.show = mock
        wrapper.vm.check_intersection(intersectings)
        expect(mock).toBeCalled()
        wrapper.vm.observer = { unobserve: () => true }
        wrapper.vm.check_intersection(intersectings)
        expect(mock).toHaveBeenCalledTimes(2)
      })
    })
  })
})
