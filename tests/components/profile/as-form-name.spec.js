import { shallowMount, flushPromises } from '@vue/test-utils'
import { vi } from 'vite-plus/test'
import as_form from '@/components/profile/as-form-name'

const { mock_save, mock_me, mock_is_valid_name } = vi.hoisted(() => {
  return {
    mock_save: vi.fn(),
    mock_me: { value: { name: 'Yu G' }, __v_isRef: true },
    mock_is_valid_name: { value: true, __v_isRef: true }
  }
})

vi.mock('@/use/people', () => ({
  use_me: () => ({
    save: mock_save,
    is_valid_name: mock_is_valid_name
  }),
  name_error: name => {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (!trimmed) return 'Name is required'
    if (trimmed.length < 3) return 'At least 3 characters'
    return null
  }
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me
}))

describe('@/component/profile/as-form-name.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_me.value = { name: 'Yu G' }
    mock_is_valid_name.value = true
  })

  it('renders the profile name form', () => {
    const wrapper = shallowMount(as_form)
    expect(wrapper.find('form#profile-name').exists()).toBe(true)
    expect(wrapper.find('input#name').exists()).toBe(true)
  })

  it('shows validation error and does not save invalid names', async () => {
    mock_is_valid_name.value = false
    const wrapper = shallowMount(as_form)
    const input = wrapper.find('input#name')

    await input.trigger('focus')
    await input.setValue('ab')
    await input.trigger('blur')
    await flushPromises()

    expect(wrapper.find('#name-error').text()).toBe('At least 3 characters')
    expect(mock_save).not.toHaveBeenCalled()
  })

  it('trims and saves valid names on blur', async () => {
    const wrapper = shallowMount(as_form)
    const input = wrapper.find('input#name')

    await input.trigger('focus')
    await input.setValue('  New Name  ')
    await input.trigger('blur')
    await flushPromises()

    expect(mock_me.value.name).toBe('New Name')
    expect(mock_save).toHaveBeenCalled()
  })

  it('reverts to the initial name when clearing a saved name', async () => {
    mock_is_valid_name.value = false
    const wrapper = shallowMount(as_form)
    const input = wrapper.find('input#name')

    await input.trigger('focus')
    await input.setValue('')
    await input.trigger('blur')
    await flushPromises()

    expect(mock_me.value.name).toBe('Yu G')
    expect(mock_save).not.toHaveBeenCalled()
  })
})
