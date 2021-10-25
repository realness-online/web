import { shallowMount } from '@vue/test-utils'
import as_svg from '@/components/avatars/as-svg'
import get_item from '@/modules/item'
const person = {
  first_name: 'Scott',
  last_name: 'Fryxell',
  id: '/+16282281824',
  avatar: '/+16282281824/avatars/55446694324'
}
const avatar_html = require('fs').readFileSync('./tests/unit/html/avatar.html', 'utf8')
const avatar = get_item(avatar_html)

describe('@/components/avatars/as-svg.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_svg, {
      props: { person }
    })
  })
  describe('Renders', () => {
    it('An avatar', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Computed', () => {
    describe('.id', () => {
      it('Outputs a null when no avatar exists', () => {
        const avatar_less = { ...person }
        avatar_less.avatar = null
        wrapper = shallowMount(as_svg, {
          props: { person: avatar_less }
        })
        expect(wrapper.vm.id).toBe(null)
      })
    })
    describe('.silhouette', () => {
      it('References the working icon when working', () => {
        wrapper = shallowMount(as_svg, {
          props: { person }
        })
        wrapper.setData({ working: true })
        expect(wrapper.vm.silhouette).toBe('#working')
      })
    })
  })
  describe('Methods', () => {
    describe('#first_instance', () => {
      it('Exists', () => {
        expect(wrapper.vm.first_instance).toBeDefined()
      })
      it('Checks if item is already on page', () => {
        expect(wrapper.vm.first_instance()).toBe(true)
      })
      it('Returns false when it finds itself already rendered', async () => {
        const element = {}
        jest.spyOn(document, 'getElementById').mockImplementationOnce(() => element)
        expect(wrapper.vm.first_instance()).toBe(false)
      })
    })
    describe('#show', () => {
      it('Exists', () => {
        expect(wrapper.vm.show).toBeDefined()
      })
      it('Loads the vector', async () => {
        await wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).toBeTruthy()
      })
      it('Only loads the vector once', async () => {
        wrapper.vm.vector = avatar
        await wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).not.toBeTruthy()
      })
      it('Checks for the vector elsewhere', async () => {
        const element = {}
        jest.spyOn(document, 'getElementById').mockImplementationOnce(() => element)
        await wrapper.vm.show()
        expect(wrapper.emitted('vector-loaded')).not.toBeTruthy()
      })
    })
  })
})
