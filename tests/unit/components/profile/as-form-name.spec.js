import { shallowMount } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-name'
const person = {
  first_name: 'Yu',
  last_name: 'G',
  mobile: '4151234356'
}
describe('@/compontent/profile/as-form-name.vue', () => {
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_form, { props: { person } })
  })
  describe('Renders', () => {
    it('Profile name form', () => {
      expect(wrapper.element).toMatchSnapshot()
    })
  })
  describe('Methods', () => {
    describe('#valid', () => {
      it('3 character full names are valid', () => {
        wrapper.vm.valid()
        expect(wrapper.emitted('valid')).toBeTruthy()
      })
      it('2 character full names will fail', () => {
        const changed = { ...person }
        changed.first_name = 's'
        changed.last_name = 'f'
        wrapper.setProps({ person: changed })
        wrapper.vm.valid()
        expect(wrapper.emitted('valid')).toBeFalsy()
      })
      it('first_name is required', () => {
        const changed = { ...person }
        changed.first_name = null
        wrapper.setProps({ person: changed })
        wrapper.vm.valid()
        expect(wrapper.emitted('valid')).toBeFalsy()
      })
      it('last_name is required', () => {
        const changed = { ...person }
        changed.last_name = null
        wrapper.setProps({ person: changed })
        wrapper.vm.valid()
        expect(wrapper.emitted('valid')).toBeFalsy()
      })
    })
    describe('#modified_check', () => {
      it('Emits no updates when there are no changes', () => {
        wrapper.vm.modified_check()
        expect(wrapper.emitted('update:person')).toBeFalsy()
      })
      it('Emits updates when first name is changed', () => {
        wrapper.vm.first_name = 'Joe'
        wrapper.vm.modified_check()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Emits updates when last name is changed', () => {
        wrapper.vm.last_name = 'Schmo'
        wrapper.vm.modified_check()
        expect(wrapper.emitted('update:person')).toBeTruthy()
      })
      it('Changes button availability when valid', () => {
        wrapper.vm.modified_check()
        expect(wrapper.vm.$refs.button.disabled).toBe(false)
        const changed = { ...person }
        changed.last_name = null
        wrapper.setProps({ person: changed })
        expect(wrapper.vm.is_valid).toBe(false)
        wrapper.vm.modified_check()
        expect(wrapper.vm.$refs.button.disabled).toBe(true)
      })
    })
  })
})
