import { describe, expect, it } from 'vite-plus/test'
import {
  chat_commands,
  matching_commands,
  parse_chat_command
} from '@/utils/chat-commands'

describe('chat commands', () => {
  it('reads a slash line as a command with its arguments', () => {
    expect(parse_chat_command('/compact keep the plan')).toEqual({
      name: 'compact',
      args: 'keep the plan'
    })
    expect(parse_chat_command('  /model  ')).toEqual({
      name: 'model',
      args: ''
    })
    expect(parse_chat_command('/login')).toEqual({
      name: 'login',
      args: '',
      unknown: true
    })
  })

  it('leaves ordinary messages alone, including paths', () => {
    expect(parse_chat_command('hello')).toBeNull()
    expect(parse_chat_command('/usr/local/bin is missing')).toBeNull()
    expect(parse_chat_command('see /docs')).toBeNull()
  })

  it('suggests commands while the name is being typed', () => {
    expect(matching_commands('/c').map(c => c.name)).toEqual([
      'compact',
      'copy'
    ])
    expect(matching_commands('/').map(c => c.name)).toEqual(
      chat_commands.map(c => c.name)
    )
    expect(matching_commands('/compact now')).toEqual([])
    expect(matching_commands('hi')).toEqual([])
  })
})
