import { shallowMount } from '@vue/test-utils'
import vector_mock from './mixin_mock'
describe('@/mixins/vector_click', () => {
  describe('Methods', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallowMount(vector_mock)
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
    })
  describe('Computed', () => {
    let wrapper
    beforeEach(() => {
      wrapper = shallowMount(vector_mock)
    })
    describe('.landscape', () => {
      it('Returns false as default', () => {
        expect(wrapper.vm.vector).toBe(null)
        expect(wrapper.vm.landscape).toBe(false)
      })
      it('Returns the ratio of width to height', () => {
        wrapper.vm.vector = { viewbox: '0 0 400 300' }
        expect(wrapper.vm.landscape).toBe(true)
      })
    })
    describe('.aspect_ratio', () => {
      it('Exists', () => {
        expect(wrapper.vm.aspect_ratio).toBeDefined()
      })
      it('Slices by default', () => {
        expect(wrapper.vm.aspect_ratio).toBe('xMidYMid slice')
      })
      it('Meets if menu is true', () => {
        wrapper.vm.menu = true
        expect(wrapper.vm.aspect_ratio).toBe('xMidYMid meet')
      })
    })
  })
})
