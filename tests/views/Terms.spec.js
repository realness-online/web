import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Terms from '@/views/Terms.vue'

const mount = () =>
  shallowMount(Terms, {
    global: {
      stubs: {
        'legal-page': {
          name: 'LegalPage',
          props: ['title', 'html', 'toc'],
          template:
            '<section class="legal-page-stub"><h1 v-html="title" /><div class="doc" v-html="html" /></section>'
        }
      }
    }
  })

describe('@/views/Terms', () => {
  it('renders Terms & Privacy through legal-page', () => {
    const wrapper = mount()
    const page = wrapper.findComponent({ name: 'LegalPage' })
    expect(page.exists()).toBe(true)
    expect(page.props('title')).toBe('Terms & Privacy')
    expect(wrapper.find('h1').html()).toContain('Terms &amp; Privacy')
  })

  it('merges terms and privacy into one html body with in-page anchors', () => {
    const wrapper = mount()
    const html = wrapper.findComponent({ name: 'LegalPage' }).props('html')
    expect(html).toMatch(/terms of service/i)
    expect(html).toMatch(/privacy policy/i)
    expect(html).not.toContain('(/privacy)')
    expect(html).not.toContain('(/terms)')
    expect(html).toContain('#privacy-policy')
  })

  it('builds a combined toc with section headings', () => {
    const wrapper = mount()
    const toc = wrapper.findComponent({ name: 'LegalPage' }).props('toc')
    const ids = toc.map(item => item.id)
    expect(ids).toContain('terms-of-service')
    expect(ids).toContain('privacy-policy')
    expect(toc[0]).toEqual({
      id: 'terms-of-service',
      title: 'Terms of Service',
      level: 2
    })
    expect(toc.length).toBeGreaterThan(2)
  })
})
