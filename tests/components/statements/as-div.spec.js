import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsDiv from '@/components/statements/as-div.vue'
import { get_item } from '@/utils/item'

describe('@/components/statements/as-div', () => {
  let wrapper
  const mock_statement = {
    id: 'test-statement',
    content: 'Test content',
    html: '<div>Test content</div>'
  }

  beforeEach(() => {
    wrapper = shallowMount(AsDiv, {
      props: {
        statement: mock_statement
      }
    })
  })

  describe('Rendering', () => {
    it('renders statement content', () => {
      expect(wrapper.html()).toContain(mock_statement.content)
    })

    it('applies correct classes', () => {
      expect(wrapper.classes()).toContain('statement')
    })
  })

  describe('Content Processing', () => {
    it('processes HTML content', async () => {
      const processed_html = '<div class="processed">Test content</div>'
      vi.spyOn(wrapper.vm, 'process_html').mockReturnValue(processed_html)
      await wrapper.vm.$nextTick()
      expect(wrapper.html()).toContain('processed')
    })

    it('sanitizes HTML content', async () => {
      const unsafe_content = '<script>alert("xss")</script>Test'
      const safe_statement = {
        ...mock_statement,
        html: unsafe_content
      }

      wrapper = shallowMount(AsDiv, {
        props: { statement: safe_statement }
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.html()).not.toContain('<script>')
    })
  })

  describe('Interaction Handling', () => {
    it('emits click events', async () => {
      await wrapper.trigger('click')
      expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('handles content updates', async () => {
      const updated_content = 'Updated content'
      await wrapper.setProps({
        statement: {
          ...mock_statement,
          content: updated_content
        }
      })
      expect(wrapper.html()).toContain(updated_content)
    })
  })

  describe('Error Handling', () => {
    it('handles missing content', () => {
      wrapper = shallowMount(AsDiv, {
        props: {
          statement: { id: 'test' }
        }
      })
      expect(wrapper.html()).toBeTruthy()
    })

    it('handles malformed HTML', async () => {
      const malformed_html = '<div>Unclosed tag'
      wrapper = shallowMount(AsDiv, {
        props: {
          statement: {
            ...mock_statement,
            html: malformed_html
          }
        }
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.html()).toBeTruthy()
    })
  })
})
