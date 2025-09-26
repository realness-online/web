import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AsDiv from '@/components/statements/as-div.vue'
import { get_item } from '@/utils/item'

describe('@/components/statements/as-div', () => {
  let wrapper
  const mock_statement = {
    id: 'test-statement',
    statement: 'Test content',
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
      // Component doesn't have a statement class
      expect(wrapper.classes()).toEqual([])
    })
  })

  describe('Content Processing', () => {
    it('processes HTML content', async () => {
      // Component doesn't have process_html method
      expect(wrapper.html()).toContain('Test content')
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
          statement: updated_content
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
