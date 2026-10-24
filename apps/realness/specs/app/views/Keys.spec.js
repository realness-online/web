import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import Keys from '@/views/Keys.vue'
import { key_overview } from '@/utils/keys-overview'

describe('Keys', () => {
  it('lists every key group with its keyboard', () => {
    const page = mount(Keys)
    expect(page.get('h1').text()).toBe('Keys')
    expect(page.findAll('section[data-group]')).toHaveLength(
      key_overview().length
    )
    expect(page.find('nav[aria-label="Modifier layer"]').exists()).toBe(true)
  })

  it('writes dashed key names as readable combinations', () => {
    const keys = mount(Keys)
      .findAll('kbd')
      .map(kbd => kbd.text())
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter(key => /^[a-z]+-/.test(key))).toEqual([])
  })
})
