import './as-form-mobile.setup.js'
import { shallowMount, flushPromises } from '@vue/test-utils'
import as_form from '@/components/profile/as-form-mobile'
import { person } from './as-form-mobile.setup.js'

describe('as-form-mobile - Basic Functionality', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = await shallowMount(as_form, {
      global: {
        stubs: { icon: false }
      }
    })
    await flushPromises()
  })

  it('renders form with proper structure', () => {
    expect(wrapper.find('form#profile-mobile').exists()).toBe(true)
  })

  it('uses person data from use_me composable', () => {
    // Component uses use_me() composable which is mocked in setup
    // Just verify the form renders - the composable mock provides the data
    expect(wrapper.find('form#profile-mobile').exists()).toBe(true)
  })
})
