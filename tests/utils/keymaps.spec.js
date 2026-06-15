import { describe, expect, it } from 'vitest'
import {
  get_keys_for_command,
  get_preference_cycle_hint,
  get_preference_cycle_keys,
  get_preference_hint,
  get_preference_icon,
  get_preference_keys,
  preference_command
} from '@/utils/keymaps'

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
