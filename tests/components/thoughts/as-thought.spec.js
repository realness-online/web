import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsThought from '@/components/thoughts/as-thought.vue'
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
      props: {
        thought: mock_thought
      }
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
        props: { thought: safe_thought }
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.html()).not.toContain('<script>')
    })
  })

  describe('Interaction Handling', () => {
    it('emits focused when contenteditable receives focus', async () => {
      wrapper = shallowMount(AsThought, {
        props: { thought: mock_thought, editable: true }
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

  describe('Error Handling', () => {
    it('handles missing content', () => {
      wrapper = shallowMount(AsThought, {
        props: {
          thought: { id: 'test' }
        }
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
        }
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.html()).toBeTruthy()
    })
  })
})
