import './as-form-mobile.setup.js'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'

describe('as-form-mobile - Paste Functionality', () => {
  let wrapper, input

  beforeEach(async () => {
    wrapper = await shallowMount(as_form, {
      global: { stubs: { icon: false } }
    })
    await flushPromises()
    await wrapper.vm.$nextTick()
    input = wrapper.find('#mobile')
  })

  it('Reject invalid mobile number', async () => {
    const initial_value = wrapper.vm.mobile_number
    await input.trigger('paste', {
      clipboardData: { getData: () => 'abc-123-1234' }
    })
    expect(wrapper.vm.mobile_number).toBe(initial_value)
  })

  it('Accept 4155550142', async () => {
    await input.trigger('paste', {
      clipboardData: { getData: () => '4155550142' }
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.mobile_number).toBe('4155550142')
  })

  it('Accept (415) 555-0142', async () => {
    await input.trigger('paste', {
      clipboardData: { getData: () => '(415) 555-0142' }
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.mobile_number).toBe('4155550142')
  })

  it('Accept 415.555.0142', async () => {
    await input.trigger('paste', {
      clipboardData: { getData: () => '415.555.0142' }
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.mobile_number).toBe('4155550142')
  })

  it('Accept 415-555-0142', async () => {
    await input.trigger('paste', {
      clipboardData: { getData: () => '415-555-0142' }
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.mobile_number).toBe('4155550142')
  })
})
