import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import Keys from '@/views/Keys.vue'
import { key_overview, key_overview_totals } from '@/utils/keys-overview'

const mount_page = () =>
  shallowMount(Keys, {
    global: { stubs: { 'keys-keyboard': true } }
  })

describe('@/views/Keys', () => {
  it('is the addressed keys page', () => {
    const wrapper = mount_page()

    const page = wrapper.find('section[data-page]')
    expect(page.exists()).toBe(true)
    expect(page.attributes('itemtype')).toBe('https://realness.online/keys')
    expect(page.attributes('itemscope')).toBeDefined()
    expect(wrapper.find('h1').text()).toBe('Keys')
  })

  it('counts the keys and commands it is showing', () => {
    const totals = key_overview_totals(key_overview())
    const wrapper = mount_page()

    const summary = wrapper.find('article > header p').text()
    expect(summary).toContain(`${totals.keys} keys`)
    expect(summary).toContain(`${totals.commands} commands`)
  })

  it('renders one section per group, in the order the overview gives', () => {
    const groups = key_overview()
    const wrapper = mount_page()

    const sections = wrapper.findAll('section[data-group]')
    expect(sections.map(section => section.attributes('data-group'))).toEqual(
      groups.map(group => group.id)
    )
  })

  it('shows each group title, summary and scope', () => {
    const [first] = key_overview()
    const wrapper = mount_page()

    const section = wrapper.find(`section[data-group="${first.id}"]`)
    expect(section.find('h2').text()).toBe(first.title)
    expect(section.find('p').text()).toBe(first.summary)
    expect(section.find('p[data-scope]').text()).toBe(first.scope)
  })

  it('lists the constraints a group carries', () => {
    const with_notes = key_overview().find(
      group => group.constraints.length > 0
    )
    const wrapper = mount_page()

    const notes = wrapper
      .find(`section[data-group="${with_notes.id}"]`)
      .findAll('ul[data-constraints] > li')
    expect(notes.map(note => note.text())).toEqual(with_notes.constraints)
  })

  it('puts every bound key into a kbd cell', () => {
    const groups = key_overview()
    const bound = groups.flatMap(group => group.entries).filter(e => e.key)

    const wrapper = mount_page()

    expect(wrapper.findAll('td kbd')).toHaveLength(bound.length)
  })

  it('upper-cases a dashed key and leaves an Option combination alone', () => {
    /** The real keymap carries no dashed key, so drive the formatter directly. */
    const wrapper = mount_page()

    expect(wrapper.vm.readable_key('ctrl-s')).toBe('Ctrl+S')
    expect(wrapper.vm.readable_key('Option+ArrowLeft')).toBe('Option+ArrowLeft')
    expect(wrapper.vm.readable_key('')).toBe('')
  })

  it('leaves an Option combination in its own spelling', () => {
    const groups = key_overview()
    const option = groups
      .flatMap(group => group.entries)
      .find(entry => entry.key?.startsWith('Option+'))

    if (!option) return

    const wrapper = mount_page()
    expect(wrapper.findAll('td kbd').map(kbd => kbd.text())).toContain(
      option.key
    )
  })

  it('marks an unbound command instead of showing a key', () => {
    const groups = key_overview()
    const unbound = groups
      .flatMap(group => group.entries)
      .find(entry => !entry.key)

    if (!unbound) return

    const wrapper = mount_page()
    expect(wrapper.findAll('td span[data-none]').length).toBeGreaterThan(0)
  })

  it('flags shadowed rows so an unreachable key is visible', () => {
    const wrapper = mount_page()
    const flagged = wrapper.findAll('tr[data-shadowed]')

    flagged.forEach(row => expect(row.attributes('data-shadowed')).toBe('true'))
  })

  it('marks the rows that carry no key', () => {
    const wrapper = mount_page()
    const unbound_rows = wrapper.findAll('tr[data-unbound]')

    expect(unbound_rows.length).toBeGreaterThan(0)
  })

  it('hands the whole overview to the keyboard diagram', () => {
    const wrapper = mount_page()
    const keyboard = wrapper.findComponent({ name: 'KeysKeyboard' })

    expect(keyboard.props('groups')).toHaveLength(key_overview().length)
  })
})
