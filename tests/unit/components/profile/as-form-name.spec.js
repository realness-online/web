import { shallowMount } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-name'
describe('@/compontent/profile/as-form-name.vue', () => {
  const person = {
    first_name: 'Scott',
    last_name: 'Fryxell',
    mobile: '4151234356'
  }
  let wrapper
  beforeEach(() => {
    wrapper = shallowMount(as_form, { propsData: { person: person } })
  })
  it('Render profile name form', () => {
    expect(wrapper.element).toMatchSnapshot()
  })
  it.todo('requires at least 3 letters total for a name')
  it.todo('only shows the submit button when input is valid')
})
