import { describe, expect, it } from 'vite-plus/test'
import { compare_tails, upstream_note } from '@/utils/explorer-view'

const self = (local_moved, seen = { writer: 'tab', tail: 5 }) => ({
  writer: 'tab',
  seen,
  local_moved
})
const view = (writer, tail) => ({ writer, tail, lines: [] })

describe('compare tails', () => {
  it('continues when nobody else wrote', () => {
    expect(compare_tails(self(true), view(null, 0))).toBe('continue')
    expect(compare_tails(self(true), view('tab', 5))).toBe('continue')
    expect(
      compare_tails(self(true, { writer: 'phone', tail: 9 }), view('phone', 9))
    ).toBe('continue')
  })

  it('hands over the pen when only the other device moved', () => {
    expect(compare_tails(self(false), view('phone', 9))).toBe('yield')
  })

  it('takes the pen when the tab is fresh', () => {
    expect(
      compare_tails(self(false, { writer: null, tail: 0 }), view('closed', 9))
    ).toBe('continue')
  })

  it('branches when both moved', () => {
    expect(compare_tails(self(true), view('phone', 9))).toBe('branch')
  })

  it('writes the other device lines as one note', () => {
    expect(
      upstream_note([
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'hello' }
      ])
    ).toBe(
      'From the conversation on another device:\nuser: hi\nassistant: hello'
    )
  })
})
