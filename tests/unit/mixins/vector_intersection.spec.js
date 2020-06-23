import { shallow } from 'vue-test-utils'
import vector_mock from './mixin_mock'
describe('@/mixins/vector_click', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallow(vector_mock)
  })
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('#destroy', () => {
    it('Exists', () => {
      expect(wrapper.destroy).toBeDefined()
    })
    it('resets the observer', () => {
      const mock = jest.fn()
      wrapper.vm.observer = { unobserve: mock }
      wrapper.destroy()
      expect(mock).toBeCalled()
    })
    it('does nothing if null observer', () => {
      wrapper.destroy()
    })
  })
  describe('methods', () => {
    describe('#intersect', () => {
      it('Exists', () => {
        expect(wrapper.vm.intersect).toBeDefined()
      })
      it('resets the observer', () => {
        wrapper.vm.intersect()
      })
    })
    describe('#check_intersection', () => {
      it('Exists', () => {
        expect(wrapper.vm.check_intersection).toBeDefined()
      })
      it('checks entries', () => {
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
