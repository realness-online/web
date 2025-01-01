import { shallowMount } from '@vue/test-utils'
import { vi } from 'vitest'
import as_figure from '@/components/posters/as-figure'
import get_item from '@/use/item'

const poster_html = read_mock_file('@@/html/poster.html')
const poster = get_item(poster_html)
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_figure, { props: { itemid: poster.id } })
  })
  describe('Renders', () => {
    it('A poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A new poster', async () => {
      await wrapper.setProps({ new_poster: poster })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.background', () => {
      it('Returns background when figure is working', () => {
        wrapper.setProps({ working: true })
        expect(wrapper.vm.background).toBe('working')
      })
    })
  })
  describe('Watchers', () => {
    describe('new_poster', () => {
      it('Sets menu to true', async () => {
        expect(wrapper.vm.menu).toBe(false)
        const new_poster = { ...poster }
        await wrapper.setProps({ new_poster })
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Leaves poster alone when null', async () => {
        wrapper = shallowMount(as_figure, {
          props: {
            itemid: poster.id,
            new_poster: poster
          }
        })
        wrapper.vm.poster = poster
        await wrapper.setProps({ new_poster: null })
        expect(wrapper.vm.new_poster).toBe(null)
        expect(wrapper.vm.poster.id).toBe(poster.id)
      })
    })
  })
  describe('Methods', () => {
    describe('#open_sms_app', () => {
      it('Opens a window to users default messenger', () => {
        window.open = vi.fn()
        wrapper.vm.open_sms_app()
        expect(window.open).toBeCalled()
      })
    })
    describe('#on_load', () => {
      it('Sets loaded to true', async () => {
        await wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
      })
      it('Emits an event after rendering svg', async () => {
        await wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
        expect(wrapper.emitted('loaded')).toBeTruthy()
      })
    })
  })
})

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
