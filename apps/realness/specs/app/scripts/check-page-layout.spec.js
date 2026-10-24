import { describe, expect, it, vi, afterEach } from 'vite-plus/test'
import { main } from '../../../scripts/check-page-layout.js'

const fits = {
  left: 0,
  expected_left: 0,
  right: 100,
  page_right: 100,
  width: 100,
  scroll: 100
}
const thoughts = { ...fits, columns: '1fr' }
const docs = { ...fits, columns: 'none', docs_width: 0, docs_gate: 1 }
const header = {
  center: 10,
  controls: [{ center: 10, outline: 'none' }]
}

/** Fake agent-browser: answers each call the way a fitting page would. */
const browser = (answers = {}) => {
  const calls = []
  const exec = (command, args, options) => {
    calls.push({ command, args, input: options.input })
    const source = options.input ?? ''
    let result
    if (source.includes('#about > span')) result = answers.header ?? header
    else if (source.includes('Documentation')) result = answers.docs ?? docs
    else if (source) result = answers.thoughts ?? thoughts
    return JSON.stringify({ success: true, data: { result } })
  }
  return { exec, calls }
}

afterEach(() => vi.restoreAllMocks())

describe('check-page-layout', () => {
  it('opens, checks every width, and closes', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const { exec, calls } = browser()
    await main({ exec, css: 'body{}' })
    const verbs = calls.map(({ args }) => args[3])
    expect(calls.every(({ command }) => command === 'agent-browser')).toBe(true)
    expect(calls[0].args).toContain('open')
    expect(verbs.filter(verb => verb === 'set')).toHaveLength(7)
    expect(verbs.filter(verb => verb === 'eval')).toHaveLength(6 * 4 + 1)
    expect(verbs.at(-1)).toBe('close')
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^Page layout/)
    )
  })

  it.each([
    ['thoughts', { ...thoughts, left: 50, expected_left: 0 }, /chat offset/],
    ['docs', { ...docs, left: 0, expected_left: 50 }, /overlaps chat/],
    ['docs', { ...docs, right: 200 }, /beyond its shell/],
    ['docs', { ...docs, scroll: 300 }, /overflows/],
    ['docs', { ...docs, columns: '1fr 1fr' }, /docs width/],
    ['thoughts', { ...thoughts, columns: '1fr 1fr' }, /one column/]
  ])('fails when %s layout breaks', async (page, answer, message) => {
    const { exec, calls } = browser({ [page]: answer })
    await expect(main({ exec, css: '' })).rejects.toThrow(message)
    expect(calls.at(-1).args[3]).toBe('close')
  })

  it('fails when header icons draw an outline or misalign', async () => {
    const outlined = browser({
      header: { center: 10, controls: [{ center: 10, outline: 'solid' }] }
    })
    await expect(main({ exec: outlined.exec, css: '' })).rejects.toThrow(
      /no focus outline/
    )
    const low = browser({
      header: { center: 10, controls: [{ center: 20, outline: 'none' }] }
    })
    await expect(main({ exec: low.exec, css: '' })).rejects.toThrow(
      /align with the question mark/
    )
  })

  it('reports a failed browser command', async () => {
    const { exec } = browser({ thoughts: { left: -500, expected_left: 0 } })
    await expect(main({ exec, css: '' })).rejects.toThrow(/chat offset/)
  })
})
