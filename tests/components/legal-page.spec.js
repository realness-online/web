import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import LegalPage from '@/components/legal-page.vue'

const router_link_stub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>'
}

const mount = (props = {}) =>
  shallowMount(LegalPage, {
    props: {
      title: 'Terms',
      html: '<p>Hello legal</p>',
      ...props
    },
    global: { stubs: { 'router-link': router_link_stub } }
  })

describe('@/components/legal-page', () => {
  it('renders the title and document html', () => {
    const wrapper = mount()
    expect(wrapper.find('h1').text()).toBe('Terms')
    expect(wrapper.find('[itemprop="content"]').html()).toContain(
      '<p>Hello legal</p>'
    )
  })

  it('omits the toc when empty', () => {
    const wrapper = mount({ toc: [] })
    expect(wrapper.find('nav[aria-label="Table of contents"]').exists()).toBe(
      false
    )
  })

  it('lists toc entries as fragment links', () => {
    const wrapper = mount({
      toc: [
        { id: 'overview', title: 'Overview', level: 2 },
        { id: 'detail', title: 'Detail', level: 3 }
      ]
    })
    const links = wrapper.findAll('nav[aria-label="Table of contents"] a')
    expect(links).toHaveLength(2)
    expect(links[0].text()).toBe('Overview')
    expect(links[0].attributes('href')).toBe('#overview')
    expect(links[1].attributes('data-level')).toBe('3')
  })
})
