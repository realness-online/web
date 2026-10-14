import { describe, it, expect, vi } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'

const mount_form = async props => {
  const wrapper = shallowMount(as_form, { props })
  await flushPromises()
  return wrapper
}

describe('as-form-mobile - mobile input and country list', () => {
  it('accepts a digit on keypress', async () => {
    const wrapper = await mount_form({ person })
    const stub = vi.fn()

    await wrapper
      .find('#mobile')
      .trigger('keypress', { key: '7', preventDefault: stub })

    expect(stub).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('accepts a leading plus only while the field is empty', async () => {
    const wrapper = await mount_form({ person })
    const stub = vi.fn()

    await wrapper
      .find('#mobile')
      .trigger('keypress', { key: '+', preventDefault: stub })
    expect(stub).not.toHaveBeenCalled()

    wrapper.vm.mobile_number = '415'
    await wrapper.vm.$nextTick()
    await wrapper
      .find('#mobile')
      .trigger('keypress', { key: '+', preventDefault: stub })
    expect(stub).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('blocks any key that is not a digit or plus', async () => {
    const wrapper = await mount_form({ person })
    const stub = vi.fn()

    await wrapper
      .find('#mobile')
      .trigger('keypress', { key: 'x', preventDefault: stub })

    expect(stub).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('validates an emptied field instead of parsing it', async () => {
    const wrapper = await mount_form({ person })

    wrapper.vm.mobile_number = ''
    await wrapper.find('#mobile').trigger('input')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('falls back to as-you-type for a number that does not parse yet', async () => {
    const wrapper = await mount_form({ person })

    wrapper.vm.mobile_number = '415'
    await wrapper.find('#mobile').trigger('input')
    await flushPromises()

    expect(typeof wrapper.vm.mobile_number).toBe('string')
    wrapper.unmount()
  })

  it('opens the country list and shows every country', async () => {
    const wrapper = await mount_form({ person })
    const toggle = wrapper.find('#country-toggle')

    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')

    const list = wrapper.find('select#country')
    expect(list.exists()).toBe(true)
    expect(list.findAll('option').length).toBeGreaterThan(1)
    expect(toggle.attributes('aria-controls')).toBe('country')
    wrapper.unmount()
  })

  it('closes the country list once a country is chosen', async () => {
    const wrapper = await mount_form({ person })
    await wrapper.find('#country-toggle').trigger('click')

    const list = wrapper.find('select#country')
    const other = list
      .findAll('option')
      .find(option => option.element.value !== 'US')
    await list.setValue(other.element.value)
    await list.trigger('change')

    expect(wrapper.find('select#country').exists()).toBe(false)
    wrapper.unmount()
  })

  it('labels the toggle with the chosen country', async () => {
    const wrapper = await mount_form({ person })

    expect(wrapper.find('#country-toggle').attributes('aria-label')).toMatch(
      /^Country, /
    )
    wrapper.unmount()
  })

  it('shows a placeholder for the default country', async () => {
    const wrapper = await mount_form({ person })

    expect(wrapper.find('#mobile').attributes('placeholder')).toBeTruthy()
    wrapper.unmount()
  })
})
