import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { mount, flushPromises } from '@vue/test-utils'
import AsPromptAgent from '@/components/as-prompt-agent.vue'

vi.mock('@/content/agent-prompt-instance.md?raw', () => ({
  default: 'Build your own Realness instance.'
}))

const COPY_FEEDBACK_MS = 2000

describe('@/components/as-prompt-agent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const with_clipboard = () => {
    const write_text = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: write_text }
    })
    return write_text
  }

  it('copies the instance prompt and says so, then goes back', async () => {
    const write_text = with_clipboard()
    const wrapper = mount(AsPromptAgent)
    const button = wrapper.find('button')

    expect(button.text()).toBe('Copy instance prompt')
    await button.trigger('click')
    await flushPromises()

    expect(write_text).toHaveBeenCalledWith('Build your own Realness instance.')
    expect(button.text()).toBe('Copied!')

    vi.advanceTimersByTime(COPY_FEEDBACK_MS)
    await flushPromises()
    expect(button.text()).toBe('Copy instance prompt')
    wrapper.unmount()
  })

  it('explains what the prompt is for, unless it is inline', () => {
    const full = mount(AsPromptAgent)
    expect(full.find('section[data-prompt-agent] h3').exists()).toBe(true)
    expect(full.text()).toContain('Cursor')
    full.unmount()

    const inline = mount(AsPromptAgent, { props: { inline: true } })
    expect(inline.find('section[data-prompt-agent]').exists()).toBe(false)
    expect(inline.find('button').text()).toBe('Copy prompt')
    inline.unmount()
  })

  it('survives a clipboard that refuses', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    const wrapper = mount(AsPromptAgent)
    const button = wrapper.find('button')

    await button.trigger('click')
    await flushPromises()

    expect(button.text()).toBe('Copy instance prompt')
    wrapper.unmount()
  })
})
