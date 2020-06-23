import { shallow } from 'vue-test-utils'
import vector_mock from './mixin_mock'
describe('@/mixins/vector_click', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })
  describe('methods', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(vector_mock)
    })
    describe('#vector_click', () => {
      it('Exists', () => {
        expect(wrapper.vm.vector_click).toBeDefined()
      })
      it('Toggles the menu', () => {
        expect(wrapper.vm.menu).toBe(false)
        wrapper.vm.vector_click()
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Emits an event', () => {
        wrapper.vm.vector_click()
        expect(wrapper.emitted('vector-click')).toBeTruthy()
      })
    })
    describe('#ratio', () => {
      it('Exists', () => {
        expect(wrapper.vm.ratio).toBeDefined()
      })
      it('returns 1.33 as default', () => {
        expect(wrapper.vm.vector).toBe(null)
        expect(wrapper.vm.ratio()).toBe(1.33)
      })
      it('returns the ratio of width to height', () => {
        wrapper.vm.vector = { viewbox: '0 0 400 300' }
        wrapper.vm.ratio()
        expect(wrapper.vm.ratio()).toBe(0.75)
      })
    })
  })
  describe('computed', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallow(vector_mock)
    })
    describe('#aspect_ratio', () => {
      it('Exists', () => {
        expect(wrapper.vm.aspect_ratio).toBeDefined()
      })
      describe('without menu', () => {
        it('Slices by default', () => {
          expect(wrapper.vm.aspect_ratio).toBe('xMidYMid slice')
        })
        it('Meets if the aspect ratio is less then 1.1', () => {
          wrapper.vm.vector = { viewbox: '0 0 400 300' }
          expect(wrapper.vm.aspect_ratio).toBe('xMidYMid meet')
        })
      })
      describe('with menu', () => {
        beforeEach(() => {
          wrapper.vm.menu = true
        })
        it('Meets by default', () => {
          expect(wrapper.vm.aspect_ratio).toBe('xMidYMid meet')
        })
        it('slices if the aspect ratio is less then 1.1', () => {
          wrapper.vm.vector = { viewbox: '0 0 400 300' }
          expect(wrapper.vm.aspect_ratio).toBe('xMidYMid slice')
        })
      })
    })
  })
})
