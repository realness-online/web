import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import as_article from '@/components/thoughts/as-article'
import AsThought from '@/components/thoughts/as-thought'
import vector_mock from './mixin_mock'

const statement = {
  statement: 'I am saying it',
  id: '/+14151234356/statements/1557614404580'
}
const older_statement = {
  statement: 'I can say all the stuff',
  id: '/+14151234356/statements/1553460776031'
}

describe('@/components/thoughts/as-article.vue', () => {
  let wrapper
  let observer_callback

  beforeEach(async () => {
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn().mockImplementation(cb => {
        observer_callback = cb
        return { observe: vi.fn(), unobserve: vi.fn() }
      })
    )
    wrapper = await shallowMount(as_article, {
      props: { thoughts: [statement, older_statement] }
    })
    await flushPromises()
  })

  describe('Renders', () => {
    it('Render a thought as an article element', async () => {
      expect(wrapper.element).toMatchSnapshot()
      wrapper.unmount()
    })
    it('Loads the thought author if verbose is true', async () => {
      wrapper = await shallowMount(as_article, {
        props: {
          verbose: true,
          thoughts: [statement, older_statement]
        }
      })
      expect(wrapper.element).toMatchSnapshot()
    })
  })

  describe('IntersectionObserver', () => {
    it('Emits show when visible', () => {
      observer_callback([{ isIntersecting: true }])
      expect(wrapper.emitted('show')).toBeTruthy()
    })
  })

  describe('Focus handling', () => {
    it('Emits focused when thought receives focus', () => {
      wrapper.findComponent(AsThought).vm.$emit('focused', statement)
      expect(wrapper.emitted('focused')).toBeTruthy()
    })
    it('Emits blurred when thought loses focus after delay', () => {
      vi.useFakeTimers()
      wrapper.findComponent(AsThought).vm.$emit('blurred', statement)
      vi.runAllTimers()
      expect(wrapper.emitted('blurred')).toBeTruthy()
      vi.useRealTimers()
    })
    it('Does not emit blurred when focus moves to another thought', () => {
      vi.useFakeTimers()
      const thoughts = wrapper.findAllComponents(AsThought)
      thoughts[0].vm.$emit('blurred', statement)
      thoughts[1].vm.$emit('focused', older_statement)
      vi.runAllTimers()
      expect(wrapper.emitted('blurred')).toBeFalsy()
      vi.useRealTimers()
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
        expect(mock).toHaveBeenCalled()
        wrapper.vm.observer = { unobserve: () => true }
        wrapper.vm.check_intersection(intersectings)
        expect(mock).toHaveBeenCalledTimes(2)
      })
    })
  })
})
