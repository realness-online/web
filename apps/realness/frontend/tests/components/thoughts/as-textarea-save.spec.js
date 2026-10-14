import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Wat from '@/components/thoughts/as-textarea'

const { mock_save, handlers } = vi.hoisted(() => ({
  mock_save: vi.fn(() => Promise.resolve()),
  handlers: {}
}))

vi.mock('@/use/statements', () => ({ use: () => ({ save: mock_save }) }))

vi.mock('@/use/key-commands', () => ({
  use_keymap: () => ({
    register: (name, handler) => {
      handlers[name] = handler
    }
  })
}))

/** The component reads the live textarea by id, so the test supplies one. */
const with_textarea = (value = '') => {
  const textarea = document.createElement('textarea')
  textarea.id = 'wat'
  textarea.value = value
  textarea.style.height = ''
  textarea.selectionStart = value.length
  textarea.selectionEnd = value.length
  Object.defineProperty(textarea, 'scrollHeight', { value: 80 })
  document.body.appendChild(textarea)
  return textarea
}

const mount_wat = () =>
  shallowMount(Wat, { global: { stubs: { icon: true } } })

describe('@/components/thoughts/as-textarea saving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    for (const name of Object.keys(handlers)) delete handlers[name]
  })

  it('saves the trimmed thought and closes the keyboard', async () => {
    with_textarea()
    const wrapper = mount_wat()
    wrapper.vm.thought_text = '  a thought  '

    await wrapper.vm.on_prepare_thought()

    expect(mock_save).toHaveBeenCalledWith('a thought')
    expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
  })

  it('saves nothing for an empty thought', async () => {
    with_textarea()
    const wrapper = mount_wat()
    wrapper.vm.thought_text = '   '

    await wrapper.vm.on_prepare_thought()

    expect(mock_save).not.toHaveBeenCalled()
  })

  it('saves nothing when there is no text at all', async () => {
    with_textarea()
    const wrapper = mount_wat()
    wrapper.vm.thought_text = null

    await wrapper.vm.on_prepare_thought()

    expect(mock_save).not.toHaveBeenCalled()
  })

  it('grows the textarea to its content', () => {
    const textarea = with_textarea()
    const wrapper = mount_wat()

    wrapper.vm.on_adjust_height({ target: textarea })

    expect(textarea.style.height).toBe('80px')
  })

  it('inserts a new line at the cursor', () => {
    const textarea = with_textarea('ab')
    textarea.selectionStart = 1
    textarea.selectionEnd = 1
    const wrapper = mount_wat()

    handlers['thought::New_Line']()

    expect(textarea.value).toBe('a\nb')
    expect(wrapper.vm.thought_text).toBe('a\nb')
  })

  it('clears the draft on cancel', () => {
    with_textarea()
    const wrapper = mount_wat()
    wrapper.vm.thought_text = 'draft'

    handlers['thought::Cancel']()

    expect(wrapper.vm.thought_text).toBeNull()
    expect(wrapper.emitted('toggle-keyboard')).toBeTruthy()
  })

  it('forwards the save shortcut', async () => {
    with_textarea()
    const wrapper = mount_wat()
    wrapper.vm.thought_text = 'from the shortcut'

    await handlers['thought::Save']()

    expect(mock_save).toHaveBeenCalledWith('from the shortcut')
  })
})
