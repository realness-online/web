import { describe, it, expect } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import VaultAbout from '@/views/VaultAbout.vue'
import VaultDocs from '@/views/VaultDocs.vue'

const links_of = view =>
  mount(view, {
    global: {
      stubs: {
        'router-link': { props: ['to'], template: '<a :href="to"><slot /></a>' }
      }
    }
  })
    .findAll('a')
    .map(link => link.attributes('href'))

describe('@/views/VaultAbout', () => {
  it('links back to the vault and its docs', () => {
    expect(links_of(VaultAbout)).toEqual(['/vault', '/vault/docs'])
  })
})

describe('@/views/VaultDocs', () => {
  it('links to every vault page it describes', () => {
    expect(links_of(VaultDocs)).toEqual([
      '/vault',
      '/vault/about',
      '/vault',
      '/vault/commands',
      '/vault/tools',
      '/vault/maps/modules',
      '/vault/maps/ways-in',
      '/vault/keys'
    ])
  })
})
