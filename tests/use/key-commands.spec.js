import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, reactive } from 'vue'
import { use_key_commands } from '@/use/key-commands'

// Mock dependencies
vi.mock('@vueuse/core', () => ({
  useMagicKeys: vi.fn(() => ({}))
}))

vi.mock('@/utils/keymaps', () => ({
  default_keymap: [
    {
      context: 'Global',
      bindings: {
        'cmd+s': 'file::save',
        'cmd+k': 'palette::toggle',
        escape: 'modal::close'
      }
    },
    {
      context: 'Editor',
      bindings: {
        'cmd+b': 'editor::bold',
        'cmd+i': 'editor::italic'
      }
    }
  ],
  normalize_key_for_platform: vi.fn(key => key),
  parse_key_combination: vi.fn(key => ({ key, modifiers: [] })),
  validate_keymap_runtime: vi.fn(() => ({ valid: true, errors: [] })),
  get_keymap_stats: vi.fn(() => ({ total: 5, conflicts: 0 }))
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

describe('key-commands composable', () => {
  let key_commands

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    key_commands = use_key_commands()
  })

  describe('initialization', () => {
    it('initializes with Global context', () => {
      expect(key_commands.active_contexts.value).toEqual(['Global'])
    })

    it('initializes with empty command handlers', () => {
      expect(key_commands.command_handlers.size).toBe(0)
    })

    it('loads default keymap', () => {
      expect(key_commands.keymap.value).toHaveLength(2)
      expect(key_commands.keymap.value[0].context).toBe('Global')
      expect(key_commands.keymap.value[1].context).toBe('Editor')
    })
  })

  describe('command registration', () => {
    it('register_handler adds command handler', () => {
      const handler = vi.fn()
      key_commands.register_handler('test::command', {
        handler,
        context: 'Test'
      })

      expect(key_commands.command_handlers.size).toBe(1)
      expect(key_commands.command_handlers.get('test::command')).toEqual({
        handler,
        context: 'Test',
        options: {}
      })
    })

    it('unregister_handler removes command handler', () => {
      const handler = vi.fn()
      key_commands.register_handler('test::command', {
        handler,
        context: 'Test'
      })
      expect(key_commands.command_handlers.size).toBe(1)

      key_commands.unregister_handler('test::command')
      expect(key_commands.command_handlers.size).toBe(0)
    })

    it('can register multiple commands', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      key_commands.register_handler('command1', { handler: handler1 })
      key_commands.register_handler('command2', { handler: handler2 })

      expect(key_commands.command_handlers.size).toBe(2)
    })
  })

  describe('context management', () => {
    it('set_contexts replaces active contexts', () => {
      key_commands.set_contexts(['Editor', 'Modal'])
      expect(key_commands.active_contexts.value).toEqual(['Editor', 'Modal'])
    })

    it('set_contexts accepts single string', () => {
      key_commands.set_contexts('Editor')
      expect(key_commands.active_contexts.value).toEqual(['Editor'])
    })

    it('add_context adds new context', () => {
      key_commands.add_context('Editor')
      expect(key_commands.active_contexts.value).toContain('Editor')
      expect(key_commands.active_contexts.value).toContain('Global')
    })

    it('add_context does not add duplicate', () => {
      key_commands.add_context('Global')
      expect(key_commands.active_contexts.value).toEqual(['Global'])
    })

    it('remove_context removes context', () => {
      key_commands.add_context('Editor')
      key_commands.remove_context('Editor')
      expect(key_commands.active_contexts.value).not.toContain('Editor')
    })
  })

  describe('command execution', () => {
    it('execute_command calls handler for global context', () => {
      const handler = vi.fn()
      key_commands.register_handler('test::command', {
        handler,
        context: 'global'
      })

      key_commands.execute_command('test::command')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('execute_command calls handler for active context', () => {
      const handler = vi.fn()
      key_commands.add_context('Editor')
      key_commands.register_handler('editor::command', {
        handler,
        context: 'Editor'
      })

      key_commands.execute_command('editor::command')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('execute_command does not call handler for inactive context', () => {
      const handler = vi.fn()
      key_commands.register_handler('editor::command', {
        handler,
        context: 'Editor'
      })

      key_commands.execute_command('editor::command')
      expect(handler).not.toHaveBeenCalled()
    })

    it('execute_command passes arguments to handler', () => {
      const handler = vi.fn()
      key_commands.register_handler('test::command', {
        handler,
        context: 'global'
      })

      key_commands.execute_command('test::command', 'arg1', 'arg2')
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('available commands', () => {
    it('get_available_commands returns global commands', () => {
      const commands = key_commands.get_available_commands.value
      const global_commands = commands.filter(cmd => cmd.context === 'Global')

      expect(global_commands.length).toBeGreaterThan(0)
      expect(global_commands.some(cmd => cmd.command === 'file::save')).toBe(
        true
      )
    })

    it('get_available_commands includes active context commands', () => {
      key_commands.add_context('Editor')
      const commands = key_commands.get_available_commands.value

      expect(commands.some(cmd => cmd.command === 'editor::bold')).toBe(true)
    })

    it('get_available_commands excludes inactive context commands', () => {
      const commands = key_commands.get_available_commands.value

      expect(commands.some(cmd => cmd.command === 'editor::bold')).toBe(false)
    })
  })

  describe('key binding queries', () => {
    it('is_key_bound returns true for bound keys', () => {
      expect(key_commands.is_key_bound('cmd+s')).toBe(true)
    })

    it('is_key_bound returns false for unbound keys', () => {
      expect(key_commands.is_key_bound('cmd+z')).toBe(false)
    })

    it('get_command_for_key returns command for key', () => {
      expect(key_commands.get_command_for_key('cmd+s')).toBe('file::save')
    })

    it('get_command_for_key returns null for unbound key', () => {
      expect(key_commands.get_command_for_key('cmd+z')).toBe(null)
    })
  })

  describe('keymap management', () => {
    it('update_keymap updates keymap ref', () => {
      const new_keymap = [{ context: 'Test', bindings: {} }]
      key_commands.update_keymap(new_keymap)

      expect(key_commands.keymap.value).toEqual(new_keymap)
    })

    it('save_keymap stores to localStorage', () => {
      key_commands.save_keymap()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'realness_keymap',
        expect.any(String)
      )
    })

    it('load_keymap reads from localStorage', () => {
      const stored_keymap = JSON.stringify([{ context: 'Test', bindings: {} }])
      localStorageMock.getItem.mockReturnValue(stored_keymap)

      key_commands.load_keymap()
      expect(key_commands.keymap.value[0].context).toBe('Test')
    })

    it('load_keymap handles invalid JSON gracefully', () => {
      const console_warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue('invalid json')

      expect(() => key_commands.load_keymap()).not.toThrow()

      console_warn_spy.mockRestore()
    })
  })

  describe('keymap validation', () => {
    it('validate_current_keymap returns validation results', () => {
      const result = key_commands.validate_current_keymap()
      expect(result).toEqual({ valid: true, errors: [] })
    })

    it('get_statistics returns keymap stats', () => {
      const stats = key_commands.get_statistics()
      expect(stats).toEqual({ total: 5, conflicts: 0 })
    })
  })
})
