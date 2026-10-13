import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import {
  shallowMount as shallow_mount,
  flushPromises as flush_promises
} from '@vue/test-utils'
import { reactive } from 'vue'
import AsThought from '@/components/thoughts/as-thought.vue'

const id = '/+14151234356/statements/1000'
const match_media = window.matchMedia
let wrappers

const mount_thought = ({
  statement = 'Test content',
  editable = true,
  desktop = false
} = {}) => {
  window.matchMedia = vi.fn(query => ({
    matches: desktop,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  const thought = reactive({ id, statement })
  const update_statement = vi.fn(async (_id, text) => {
    thought.statement = text
  })
  const wrapper = shallow_mount(AsThought, {
    attachTo: document.body,
    props: { thought, editable },
    global: { provide: { update_statement } }
  })
  wrappers.push(wrapper)
  return { wrapper, thought, update_statement }
}

const open_editor = async wrapper => {
  await wrapper.find('p').trigger('click')
  await flush_promises()
  return wrapper.find('p[contenteditable="true"]')
}

beforeEach(() => {
  wrappers = []
})
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount())
  window.matchMedia = match_media
})

describe('@/components/thoughts/as-thought', () => {
  it('renders plain text and the statement identity', () => {
    const { wrapper } = mount_thought({ editable: false })
    expect(wrapper.attributes('itemid')).toBe(id)
    expect(wrapper.find('p[itemprop="statement"]').text()).toBe('Test content')
  })

  it('escapes markup in a statement', () => {
    const { wrapper } = mount_thought({
      statement: '<script>alert("xss")</script>'
    })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('p').text()).toBe('<script>alert("xss")</script>')
  })

  it("keeps other people's statements read-only", async () => {
    const { wrapper, update_statement } = mount_thought({ editable: false })
    await wrapper.find('p').trigger('click')
    await wrapper.find('p').trigger('dblclick')
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
    expect(wrapper.find('p').element.tabIndex).toBe(-1)
    expect(wrapper.attributes('data-editable')).toBeUndefined()
    expect(update_statement).not.toHaveBeenCalled()
  })

  it('opens touch editing before the tap handler returns', async () => {
    const { wrapper } = mount_thought()
    await flush_promises()
    const paragraph = wrapper.find('p').element
    paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(document.activeElement).toBe(paragraph)
    expect(paragraph.getAttribute('contenteditable')).toBe('true')
    expect(paragraph.textContent).toBe('Test content')
  })

  it('emits focus from a connected editor', async () => {
    const { wrapper } = mount_thought()
    await open_editor(wrapper)
    expect(wrapper.emitted('focused')).toBeTruthy()
  })

  it('saves a real focus and blur, then shows the saved text', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = 'Changed in the page'
    editor.element.blur()
    await flush_promises()
    expect(update_statement).toHaveBeenCalledWith(id, 'Changed in the page')
    expect(wrapper.find('p').text()).toBe('Changed in the page')
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
  })

  it('can reopen and save the same statement twice', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = 'First edit'
    editor.element.blur()
    await flush_promises()
    const reopened = await open_editor(wrapper)
    expect(reopened.element).toBe(editor.element)
    expect(reopened.text()).toBe('First edit')
    reopened.element.textContent = 'Second edit'
    reopened.element.blur()
    await flush_promises()
    expect(update_statement).toHaveBeenLastCalledWith(id, 'Second edit')
    expect(wrapper.find('p').text()).toBe('Second edit')
  })

  it('saves an emptied statement and leaves it reachable', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = ''
    editor.element.blur()
    await flush_promises()
    expect(update_statement).toHaveBeenCalledWith(id, '')
    expect(wrapper.find('p').element.tabIndex).toBe(0)
    expect((await open_editor(wrapper)).exists()).toBe(true)
  })

  it('does not save an unchanged statement', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.blur()
    await flush_promises()
    expect(update_statement).not.toHaveBeenCalled()
  })

  it('does not save a detached editor as an empty statement', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    wrapper.unmount()
    await editor.trigger('blur')
    expect(update_statement).not.toHaveBeenCalled()
  })

  it('preserves the draft and saves it when sync arrives during focus', async () => {
    const { wrapper, thought, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = 'Local draft'
    thought.statement = 'Synced text'
    await flush_promises()
    expect(editor.text()).toBe('Local draft')
    editor.element.blur()
    await flush_promises()
    expect(update_statement).toHaveBeenCalledWith(id, 'Local draft')
    expect(wrapper.find('p').text()).toBe('Local draft')
  })

  it('does not overwrite sync with an untouched editor', async () => {
    const { wrapper, thought, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    thought.statement = 'Synced text'
    await flush_promises()
    editor.element.blur()
    await flush_promises()
    expect(update_statement).not.toHaveBeenCalled()
    expect(wrapper.find('p').text()).toBe('Synced text')
  })

  it('updates resting text when the statement is patched in place', async () => {
    const { wrapper, thought } = mount_thought()
    thought.statement = 'Saved elsewhere'
    await flush_promises()
    expect(wrapper.find('p').text()).toBe('Saved elsewhere')
  })

  it('keeps an owned statement reachable by Tab, then opens with Enter', async () => {
    const { wrapper } = mount_thought({ desktop: true })
    const paragraph = wrapper.find('p').element
    expect(paragraph.tabIndex).toBe(0)
    paragraph.focus()
    await wrapper.find('p').trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(paragraph)
    expect(paragraph.getAttribute('contenteditable')).toBe('true')
    expect(wrapper.find('p').attributes('aria-readonly')).toBe('false')
  })

  it('guards a written desktop statement behind a double click', async () => {
    const { wrapper } = mount_thought({ desktop: true })
    await wrapper.find('p').trigger('click')
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
    await wrapper.find('p').trigger('dblclick')
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('p').element)
  })

  it('opens an empty desktop statement with one click', async () => {
    const { wrapper } = mount_thought({ desktop: true, statement: '' })
    expect((await open_editor(wrapper)).exists()).toBe(true)
  })

  it('honors a touch tap even when a fine pointer is also available', async () => {
    const { wrapper } = mount_thought({ desktop: true })
    await wrapper.find('p').trigger('click', { pointerType: 'touch' })
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(true)
  })

  it('finishes on Enter without sending it to the poster', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = 'Rewritten'
    const parent_keydown = vi.fn()
    wrapper.element.parentElement.addEventListener('keydown', parent_keydown)
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
    editor.element.dispatchEvent(event)
    await flush_promises()
    expect(event.defaultPrevented).toBe(true)
    expect(parent_keydown).not.toHaveBeenCalled()
    expect(update_statement).toHaveBeenCalledWith(id, 'Rewritten')
    expect(wrapper.find('[contenteditable="true"]').exists()).toBe(false)
  })

  it.each([{ shiftKey: true }, { isComposing: true }])(
    'keeps newline or composition Enter inside editing: %j',
    async options => {
      const { wrapper, update_statement } = mount_thought()
      const editor = await open_editor(wrapper)
      editor.element.textContent = 'Still editing'
      const parent_keydown = vi.fn()
      wrapper.element.parentElement.addEventListener('keydown', parent_keydown)
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        ...options
      })
      editor.element.dispatchEvent(event)
      await flush_promises()
      expect(event.defaultPrevented).toBe(false)
      expect(parent_keydown).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(editor.element)
      expect(update_statement).not.toHaveBeenCalled()
    }
  )

  it('saves browser-inserted lines as separate lines', async () => {
    const { wrapper, update_statement } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.innerHTML = 'First line<div>Second line</div>'
    editor.element.blur()
    await flush_promises()
    expect(update_statement).toHaveBeenCalledWith(id, 'First line\nSecond line')
  })

  it('does not replace the draft when the editor is focused again', async () => {
    const { wrapper } = mount_thought()
    const editor = await open_editor(wrapper)
    editor.element.textContent = 'Local draft'
    wrapper.vm.focus_editor()
    expect(editor.text()).toBe('Local draft')
  })
})
