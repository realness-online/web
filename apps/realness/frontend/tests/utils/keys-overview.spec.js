import { describe, it, expect } from 'vite-plus/test'
import { key_overview, key_overview_totals } from '@/utils/keys-overview'

describe('@/utils/keys-overview', () => {
  it('builds one group per owner, keymap-backed and listener-backed', () => {
    const groups = key_overview()
    const ids = groups.map(group => group.id)

    expect(ids).toContain('appearance')
    expect(ids).toContain('navigation')
    expect(ids).toContain('home')
    expect(ids).toContain('chat')
    expect(ids).toContain('terminal')
  })

  it('pulls the key shown from the keymap, not from the group', () => {
    const appearance = key_overview().find(g => g.id === 'appearance')
    const stroke = appearance.entries.find(
      e => e.command === 'pref::Toggle_Stroke'
    )

    expect(stroke.key).toBe('s')
    expect(stroke.description).toBe('Stroke outline on posters')
    expect(stroke.owner).toBe('keymap')
    expect(stroke.reachable).toBe(true)
  })

  it('puts every view on the number row, in order', () => {
    const groups = key_overview()
    const keys = id => groups.find(g => g.id === id).entries.map(e => e.key)
    expect(keys('home')).toEqual(['`'])
    expect(keys('navigation')).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9'
    ])
  })

  it('reports a command with no binding instead of dropping it', () => {
    const unbound = key_overview().find(g => g.id === 'unbound')
    const row = unbound.entries.find(
      e => e.command === 'pref::Toggle_Color_Cycle'
    )

    expect(row.key).toBe('')
    expect(row.reachable).toBe(false)
    expect(row.note).toMatch(/no default binding/)
  })

  it('owns page shortcuts in the keymap, so the panel and Option agree', () => {
    const navigation = key_overview().find(g => g.id === 'navigation')
    expect(navigation.entries.map(e => e.command)).toEqual([
      'nav::Go_Thoughts',
      'nav::Go_Chat',
      'nav::Go_Terminal',
      'nav::Go_Account',
      'nav::Go_About',
      'nav::Go_Docs',
      'nav::Go_Prints',
      'nav::Go_Pricing',
      'nav::Go_Legal'
    ])
  })

  it('counts keys, commands, and unbound rows', () => {
    const totals = key_overview_totals()

    expect(totals.keys).toBeGreaterThan(20)
    expect(totals.commands).toBeGreaterThan(20)
    expect(totals.unbound).toBe(3)
  })
})
describe('keyboard_layers', async () => {
  const { key_position, keyboard_layers } =
    await import('@/utils/keys-overview')

  it('places keys on their physical cap and layer', () => {
    expect(key_position('a')).toEqual({ layer: 'plain', cap: 'a' })
    expect(key_position('Z')).toEqual({ layer: 'shift', cap: 'z' })
    expect(key_position('?')).toEqual({ layer: 'shift', cap: '/' })
    expect(key_position('Option+1')).toEqual({ layer: 'option', cap: '1' })
    expect(key_position('Cmd+K')).toEqual({ layer: 'cmd', cap: 'k' })
    expect(key_position('Escape')).toEqual({ layer: 'plain', cap: 'escape' })
    expect(key_position('Any')).toBeNull()
  })

  it('gives each number-row key one owner', () => {
    const plain = keyboard_layers().plain
    for (const cap of ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
      expect(plain[cap]).toHaveLength(1)
  })
})
