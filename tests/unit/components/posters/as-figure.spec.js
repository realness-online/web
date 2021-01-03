import { shallowMount } from '@vue/test-utils'
import as_figure from '@/components/posters/as-figure'
import get_item from '@/modules/item'
const fs = require('fs')
const poster_html = fs.readFileSync('./tests/unit/html/poster.html', 'utf8')
const poster = get_item(poster_html)
describe('@/compontent/posters/as-figure.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_figure, { propsData: { itemid: poster.id } })
  })
  describe('renders:', () => {
    it('A poster', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
    it('A new poster', async () => {
      await wrapper.setProps({ new_poster: poster })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('computed:', () => {
    describe('background', () => {
      it('Returns background when figure is working', () => {
        wrapper.setProps({ working: true })
        expect(wrapper.vm.background).toBe('working')
      })
    })
  })
  describe('watch', () => {
    describe('new_poster', () => {
      it('Sets poster to new_poster', async () => {
        expect(wrapper.vm.menu).toBe(false)
        const new_poster = { ...poster }
        new_poster.id = 'new_id'
        await wrapper.setProps({ new_poster })
        expect(wrapper.vm.poster.id).toBe('new_id')
      })
      it('Sets menu to true', async () => {
        expect(wrapper.vm.menu).toBe(false)
        const new_poster = { ...poster }
        await wrapper.setProps({ new_poster })
        expect(wrapper.vm.menu).toBe(true)
      })
      it('Leaves poster alone when null', async () => {
        wrapper = shallowMount(as_figure, {
          propsData: {
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
  describe('methods:', () => {
    describe('#open_sms_app', () => {
      it('opens a window to users default messenger', () => {
        window.open = jest.fn()
        wrapper.vm.open_sms_app()
        expect(window.open).toBeCalled()
      })
    })
    describe('#on_load', () => {
      it('Sets loaded to true', () => {
        wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
      })
      it('Emits an event after rendering svg', () => {
        wrapper.vm.on_load()
        expect(wrapper.vm.loaded).toBe(true)
        expect(wrapper.emitted('loaded')).toBeTruthy()
      })
    })
  })
})
