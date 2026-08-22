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

  it('copies whatever prompt it is handed, under its own labels', async () => {
    // Two prompts share this component now: standing up an instance, and
    // driving the poster page. The default has to stay the instance one, or
    // Documentation and License start handing out the wrong text.
    const write_text = with_clipboard()
    const wrapper = mount(AsPromptAgent, {
      props: {
        prompt: 'Drive the poster page.',
        heading: 'Prompt an agent',
        desc: 'It explains the render function.',
        button: 'Copy driver prompt'
      }
    })
    const button = wrapper.find('button')

    expect(button.text()).toBe('Copy driver prompt')
    expect(wrapper.text()).toContain('It explains the render function.')

    await button.trigger('click')
    await flushPromises()

    expect(write_text).toHaveBeenCalledWith('Drive the poster page.')
    expect(write_text).not.toHaveBeenCalledWith(
      'Build your own Realness instance.'
    )
    wrapper.unmount()
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
