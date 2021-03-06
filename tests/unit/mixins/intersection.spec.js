import { shallowMount } from '@vue/test-utils'
import vector_mock from './mixin_mock'
describe('@/mixins/intersection', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(vector_mock)
  })
  describe('#destroy', () => {
    it('Exists', () => {
      expect(wrapper.destroy).toBeDefined()
    })
    it('Resets the observer', () => {
      const mock = jest.fn()
      wrapper.vm.observer = { unobserve: mock }
      wrapper.destroy()
      expect(mock).toBeCalled()
    })
    it('Does nothing if null observer', () => {
      wrapper.destroy()
    })
  })
  describe('Methods', () => {
    describe('#check_intersection', () => {
      it('Exists', () => {
        expect(wrapper.vm.check_intersection).toBeDefined()
      })
      it('Checks entries', () => {
        const intersectings = [{ isIntersecting: true }, { isIntersecting: false }]
        const mock = jest.fn()
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
