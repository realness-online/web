import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import License from '@/views/License.vue'

const mount = () =>
  shallowMount(License, {
    global: {
      stubs: {
        'legal-page': {
          name: 'LegalPage',
          props: ['title', 'html', 'toc'],
          template:
            '<section class="legal-page-stub"><h1>{{ title }}</h1><div class="doc" v-html="html" /></section>'
        }
      }
    }
  })

describe('@/views/License', () => {
  it('renders License through legal-page', () => {
    const wrapper = mount()
    const page = wrapper.findComponent({ name: 'LegalPage' })
    expect(page.exists()).toBe(true)
    expect(page.props('title')).toBe('License')
  })

  it('shows the GPL announcement, source, and potrace credit', () => {
    const html = mount().findComponent({ name: 'LegalPage' }).props('html')
    expect(html).toMatch(/without any warranty/i)
    expect(html).toContain('https://github.com/realness-online/web')
    expect(html).toContain('potrace')
    expect(html).toContain('Peter Selinger')
    expect(html).toContain('visioncortex')
    expect(html).toContain('vtracer')
    expect(html).toContain('TSANG')
    expect(html).toContain('GNU GENERAL PUBLIC LICENSE')
    expect(html).toContain('&lt;http://fsf.org/&gt;')
  })

  it('builds a toc for source, attribution, and the GPL heading', () => {
    const toc = mount().findComponent({ name: 'LegalPage' }).props('toc')
    const ids = toc.map(item => item.id)
    expect(ids).toContain('source')
    expect(ids).toContain('attribution')
    expect(ids).toContain('gnu-general-public-license-version-2')
  })
})
