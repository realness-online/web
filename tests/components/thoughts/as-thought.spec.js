import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import AsThought from '@/components/thoughts/as-thought.vue'

const mount_options = {
  global: {
    provide: { update_statement: vi.fn() }
  }
}

describe('@/components/thoughts/as-thought', () => {
  let wrapper
  const mock_thought = {
    id: 'test-thought',
    statement: 'Test content',
    content: 'Test content',
    html: '<div>Test content</div>'
  }

  beforeEach(() => {
    wrapper = shallowMount(AsThought, {
      props: { thought: mock_thought },
      ...mount_options
    })
  })

  describe('Rendering', () => {
    it('renders thought content', () => {
      expect(wrapper.html()).toContain(mock_thought.content)
    })

    it('applies correct classes', () => {
      expect(wrapper.classes()).toEqual([])
    })
  })

  describe('Content Processing', () => {
    it('processes HTML content', async () => {
      expect(wrapper.html()).toContain('Test content')
    })

    it('sanitizes HTML content', async () => {
      const unsafe_content = '<script>alert("xss")</script>Test'
      const safe_thought = {
        ...mock_thought,
        html: unsafe_content
      }

      wrapper = shallowMount(AsThought, {
        props: { thought: safe_thought },
        ...mount_options
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.html()).not.toContain('<script>')
    })
  })

  describe('Interaction Handling', () => {
    it('emits focused when contenteditable receives focus', async () => {
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true },
        ...mount_options
      })
      await wrapper.find('p[contenteditable]').trigger('focus')
      expect(wrapper.emitted('focused')).toBeTruthy()
    })

    it('handles content updates', async () => {
      const updated_content = 'Updated content'
      await wrapper.setProps({
        thought: {
          ...mock_thought,
          statement: updated_content
        }
      })
      expect(wrapper.html()).toContain(updated_content)
    })
  })

  describe('Editing', () => {
    const editor_of = w => w.find('p[contenteditable]')

    it('does not save when the editor never received its text', async () => {
      const update_statement = vi.fn()
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true },
        global: { provide: { update_statement } }
      })
      // Blur before the fill lands: an empty editor here is not an empty edit.
      await editor_of(wrapper).trigger('blur')
      expect(update_statement).not.toHaveBeenCalled()
    })

    // A statement in a poster's overlay is taken off screen when the overlay
    // closes, and the overlay closes under you if anything toggles the poster
    // while you are typing. The blur arrives with the editor already gone, and
    // an editor that is not there has no text to offer - which is not the same
    // as being asked to empty the statement.
    it('does not save when the editor is gone by the time the blur lands', async () => {
      const update_statement = vi.fn()
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true },
        global: { provide: { update_statement } }
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(editor_of(wrapper).element.textContent).toBe('Test content')

      const editor = editor_of(wrapper)
      wrapper.unmount()
      await editor.trigger('blur')

      expect(update_statement).not.toHaveBeenCalled()
    })

    // Enter finishes a statement, shift-enter opens a line - the compose box
    // makes the same bargain. Either way the key stops at the editor: a poster
    // underneath reads a bare Enter as "toggle me" and takes the overlay away.
    describe('enter', () => {
      const editing = () => {
        const update_statement = vi.fn()
        const w = shallowMount(AsThought, {
          props: { thought: mock_thought, editable: true },
          global: { provide: { update_statement } }
        })
        return { w, update_statement }
      }

      it('finishes the statement and does not travel', async () => {
        const { w, update_statement } = editing()
        await w.vm.$nextTick()
        await w.vm.$nextTick()
        const editor = editor_of(w)
        editor.element.textContent = 'Rewritten'

        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        })
        editor.element.dispatchEvent(event)
        await w.vm.$nextTick()

        expect(event.defaultPrevented).toBe(true)
        await editor.trigger('blur')
        expect(update_statement).toHaveBeenCalledWith(
          mock_thought.id,
          'Rewritten'
        )
      })

      it('leaves shift-enter to open a line', async () => {
        const { w } = editing()
        await w.vm.$nextTick()
        await w.vm.$nextTick()

        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          shiftKey: true,
          bubbles: true,
          cancelable: true
        })
        editor_of(w).element.dispatchEvent(event)
        await w.vm.$nextTick()

        expect(event.defaultPrevented).toBe(false)
      })
    })

    it('refills when the statement is patched in place', async () => {
      const update_statement = vi.fn()
      const live_thought = reactive({ ...mock_thought })
      wrapper = shallowMount(AsThought, {
        props: { thought: live_thought, editable: true },
        global: { provide: { update_statement } }
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(editor_of(wrapper).element.textContent).toBe('Test content')

      // A sync patches the statement without replacing the object.
      live_thought.statement = 'Saved elsewhere'
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(editor_of(wrapper).element.textContent).toBe('Saved elsewhere')

      // Blurring now must not push the stale text back over it.
      await editor_of(wrapper).trigger('blur')
      expect(update_statement).not.toHaveBeenCalled()
    })

    describe('on a desktop pointer', () => {
      const touch_match_media = window.matchMedia
      afterEach(() => {
        window.matchMedia = touch_match_media
      })
      const desktop = matches => {
        window.matchMedia = vi.fn(query => ({
          matches,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }))
      }
      const mount_desktop = statement => {
        desktop(true)
        return shallowMount(AsThought, {
          props: { thought: { id: 'test-thought', statement }, editable: true },
          global: { provide: { update_statement: vi.fn() } }
        })
      }

      it('opens an empty statement on a single click', async () => {
        wrapper = mount_desktop('')
        await wrapper.find('[itemscope]').trigger('click')
        await wrapper.vm.$nextTick()
        expect(editor_of(wrapper).exists()).toBe(true)
      })

      it('still guards a written statement behind the double click', async () => {
        wrapper = mount_desktop('Test content')
        await wrapper.find('[itemscope]').trigger('click')
        await wrapper.vm.$nextTick()
        expect(editor_of(wrapper).exists()).toBe(false)

        await wrapper.find('[itemscope]').trigger('dblclick')
        await wrapper.vm.$nextTick()
        expect(editor_of(wrapper).exists()).toBe(true)
      })
    })

    it('marks an editable statement so the caret shows', async () => {
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true },
        ...mount_options
      })
      expect(wrapper.find('[itemscope]').attributes('data-editable')).toBe(
        'true'
      )
    })

    it('leaves a read-only statement unmarked', async () => {
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: false },
        ...mount_options
      })
      expect(
        wrapper.find('[itemscope]').attributes('data-editable')
      ).toBeUndefined()
    })

    it('saves a deliberate edit', async () => {
      const update_statement = vi.fn()
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true },
        global: { provide: { update_statement } }
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      const editor = editor_of(wrapper)
      editor.element.textContent = 'Rewritten'
      await editor.trigger('blur')
      expect(update_statement).toHaveBeenCalledWith(
        mock_thought.id,
        'Rewritten'
      )
    })
  })

  describe('Error Handling', () => {
    it('handles missing content', () => {
      wrapper = shallowMount(AsThought, {
        props: { thought: { id: 'test' } },
        ...mount_options
      })
      expect(wrapper.html()).toBeTruthy()
    })

    it('handles malformed HTML', async () => {
      const malformed_html = '<div>Unclosed tag'
      wrapper = shallowMount(AsThought, {
        props: {
          thought: {
            ...mock_thought,
            html: malformed_html
          }
        },
        ...mount_options
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.html()).toBeTruthy()
    })
  })
})
