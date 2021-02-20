import { shallowMount } from '@vue/test-utils'
import as_hgroup from '@/components/profile/as-hgroup'
const person = {
  id: '/+14151234356',
  first_name: 'Scott',
  last_name: 'Fryxell',
  mobile: '4151234356',
  avatar: 'avatars/5553338945763'
}
describe('@/compontent/profile/as-hgroup.vue', () => {
  let wrapper
  describe('Renders', () => {
    it('A person as a hgroup element', () => {
      wrapper = shallowMount(as_hgroup, { propsData: { person } })
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    beforeEach(() => {
      wrapper = shallowMount(as_hgroup, {
        propsData: {
          person,
          editable: true
        }
      })
    })
    describe('#save_first_name', () => {
      it('Emits an event when first_name changes', async () => {
        expect(wrapper.vm.person.first_name).toBe('Scott')
        wrapper.vm.$refs.first_name.textContent = 'John'
        await wrapper.vm.$nextTick()
        wrapper.vm.save_first_name()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Stays quiet when first_name is consistent', async () => {
        expect(wrapper.vm.person.first_name).toBe('Scott')
        wrapper.vm.$refs.first_name.textContent = 'Scott'
        await wrapper.vm.$nextTick()
        wrapper.vm.save_first_name()
        expect(wrapper.emitted('update:person')).toBeFalsy()
      })
    })
    describe('#save_last_name', () => {
      it('Emits an event when last_name changes', async () => {
        expect(wrapper.vm.person.last_name).toBe('Fryxell')
        wrapper.vm.$refs.last_name.textContent = 'Johannes'
        await wrapper.vm.$nextTick()
        wrapper.vm.save_last_name()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Stays quiet when last_name is consistent', async () => {
        expect(wrapper.vm.person.last_name).toBe('Fryxell')
        wrapper.vm.$refs.last_name.textContent = 'Fryxell'
        await wrapper.vm.$nextTick()
        wrapper.vm.save_last_name()
        expect(wrapper.emitted('update:person')).toBeFalsy()
      })
    })
  })
})
