import { describe, expect, it } from 'vitest'
import {
  get_keys_for_command,
  get_preference_cycle_hint,
  get_preference_cycle_keys,
  get_preference_hint,
  get_preference_icon,
  get_preference_keys,
  get_command_description,
  get_keymap_stats,
  normalize_key_for_platform,
  validate_keymap_runtime,
  preference_command
} from '@/utils/keymaps'

describe('keymaps validate_keymap_runtime', () => {
  it('reports no errors or warnings for a clean keymap', () => {
    const result = validate_keymap_runtime([
      {
        context: 'Global',
        bindings: { a: 'pref::Toggle_Animate' }
      },
      {
        context: 'Poster',
        bindings: { b: 'pref::Stroke' }
      }
    ])
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.is_valid).toBe(true)
  })

  it('warns when a key is bound in multiple contexts', () => {
    const result = validate_keymap_runtime([
      { context: 'Global', bindings: { a: 'x' } },
      { context: 'Poster', bindings: { a: 'y' } }
    ])
    expect(result.warnings.some(w => w.includes('multiple contexts'))).toBe(
      true
    )
  })

  it('collects used commands and ignores null/undefined bindings', () => {
    const result = validate_keymap_runtime([
      {
        context: 'Global',
        bindings: { a: ['pref::Animate'], b: null, c: 'pref::Stroke' }
      }
    ])
    expect(result.used_commands).toContain('pref::Animate')
    expect(result.used_commands).toContain('pref::Stroke')
    expect(result.used_commands).not.toContain(null)
  })

  it('defaults a missing context to Global', () => {
    const result = validate_keymap_runtime([{ bindings: { a: 'x' } }])
    expect(result.errors).toEqual([])
    expect(result.is_valid).toBe(true)
  })
})

describe('keymaps get_keymap_stats', () => {
  it('counts contexts and unique commands', () => {
    const stats = get_keymap_stats([
      { context: 'Global', bindings: { a: 'x', b: 'y' } },
      { context: 'Poster', bindings: { c: 'x' } }
    ])
    expect(stats.total_contexts).toBe(2)
    expect(stats.total_bindings).toBe(3)
    expect(stats.contexts).toEqual(['Global', 'Poster'])
    expect(stats.commands).toEqual(['x', 'y'])
  })

  it('groups missing context under Global', () => {
    const stats = get_keymap_stats([{ bindings: { a: 'x' } }])
    expect(stats.contexts).toEqual(['Global'])
  })
})

describe('keymaps get_command_description', () => {
  it('returns the description when present', () => {
    expect(get_command_description('pref::Toggle_Mosaic')).toContain('Mosaic')
  })

  it('falls back to the command itself when not described', () => {
    expect(get_command_description('no::Such_Command')).toBe('no::Such_Command')
  })
})

describe('keymaps normalize_key_for_platform', () => {
  it('maps cmd to ctrl on macos', () => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel'
    })
    expect(normalize_key_for_platform('cmd-s')).toBe('ctrl-s')
  })
})

describe('keymaps preference keys', () => {
  it('maps preference names to toggle commands', () => {
    expect(preference_command.mosaic).toBe('pref::Toggle_Mosaic')
    expect(preference_command.footer_visible).toBe('pref::Toggle_Footer')
  })

  it('finds keys bound to a command', () => {
    expect(get_keys_for_command('pref::Toggle_Mosaic')).toEqual(['g'])
    expect(get_keys_for_command('pref::Toggle_Boulders')).toEqual(['Z'])
  })

  it('returns preference keys by name', () => {
    expect(get_preference_keys('shadow')).toEqual(['f'])
    expect(get_preference_keys('view_3d')).toEqual(['q'])
    expect(get_preference_keys('grid')).toEqual([])
    expect(get_preference_keys('sync_folder')).toEqual([])
  })

  it('returns uppercase cycle keys separately from toggle keys', () => {
    expect(get_preference_keys('drama')).toEqual(['d'])
    expect(get_preference_cycle_keys('drama')).toEqual(['D'])
    expect(get_preference_cycle_hint('drama')).toBe('cycles lights')
    expect(get_preference_keys('animate')).toEqual(['a'])
    expect(get_preference_cycle_keys('animate')).toEqual(['A'])
    expect(get_preference_cycle_hint('animate')).toBe('cycles speed')
  })

  it('returns short preference hints', () => {
    expect(get_preference_hint('mosaic')).toBe(
      'Tiles defining shape over shadow'
    )
    expect(get_preference_hint('sediment')).toBe('Finest pieces')
    expect(get_preference_hint('boulders')).toBe('Largest pieces')
    expect(get_preference_hint('bold')).toBe('0-10% luminosity')
    expect(get_preference_hint('light')).toBe('44-60% luminosity')
    expect(get_preference_hint('grid')).toBe('Composition grid')
    expect(get_preference_hint('sync_folder')).toBeNull()
  })

  it('returns preference icons when mapped', () => {
    expect(get_preference_icon('grid')).toBe('grid')
    expect(get_preference_icon('animate')).toBe('animation')
    expect(get_preference_icon('view_3d')).toBe('galaxy')
    expect(get_preference_icon('mosaic')).toBe('realness')
    expect(get_preference_icon('bold')).toBeNull()
  })
})
