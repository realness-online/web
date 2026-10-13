import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import AsConnectionFeedback from '@/components/chat/as-connection-feedback.vue'

const progress = {
  stage: 'restoring_files',
  state: 'starting',
  elapsed_ms: 8400
}

describe('@/components/chat/as-connection-feedback', () => {
  it('shows the reported stage and elapsed time using semantic status and duration', async () => {
    const feedback = mount(AsConnectionFeedback, { props: { progress } })
    expect(feedback.get('[role="status"]').text()).toBe('Restoring files')
    expect(feedback.get('time').text()).toBe('8.4 s reported')
    expect(feedback.get('time').attributes('datetime')).toBe('PT8.4S')
    expect(feedback.attributes('aria-busy')).toBe('true')
    expect(feedback.find('button').exists()).toBe(false)
    await feedback.setProps({
      progress: { stage: 'starting_pi', state: 'starting', elapsed_ms: 12600 }
    })
    expect(feedback.get('[role="status"]').text()).toBe('Starting Pi')
    expect(feedback.get('time').text()).toBe('12.6 s reported')
    await feedback.setProps({
      progress: {
        stage: 'starting_pi',
        state: 'complete',
        elapsed_ms: 15000,
        ms: 2400
      }
    })
    expect(feedback.get('[role="status"]').text()).toBe('Starting Pi complete')
    expect(
      feedback.get('time[title="Elapsed at last reported stage"]').text()
    ).toBe('15.0 s reported')
    expect(feedback.get('time[title="Stage duration"]').text()).toBe(
      '2.4 s in this step'
    )
    expect(
      feedback.get('time[title="Stage duration"]').attributes('datetime')
    ).toBe('PT2.4S')
    feedback.unmount()
  })

  it('never invents host startup or advance stages from waiting time', async () => {
    vi.useFakeTimers()
    const feedback = mount(AsConnectionFeedback, {
      props: { progress: { stage: 'unknown', elapsed_ms: 40000 } }
    })
    vi.advanceTimersByTime(40_000)
    expect(feedback.get('[role="status"]').text()).toBe('Connecting...')
    expect(feedback.text()).not.toContain('Starting host')
    expect(feedback.get('time').text()).toBe('40.0 s reported')
    await feedback.setProps({
      progress: { stage: ['starting_host'], elapsed_ms: 40000 }
    })
    expect(feedback.get('[role="status"]').text()).toBe('Connecting...')
    feedback.unmount()
    vi.useRealTimers()
  })

  it('keeps warning feedback and centered Retry beneath the last measured stage', async () => {
    const feedback = mount(AsConnectionFeedback, {
      props: { progress, problem: 'Actor startup failed' }
    })
    expect(feedback.get('[role="alert"]').text()).toBe('Actor startup failed')
    expect(feedback.element.children[0].tagName).toBe('P')
    expect(feedback.element.children[1].tagName).toBe('TIME')
    expect(feedback.element.children[2].tagName).toBe('BUTTON')
    expect(feedback.attributes('aria-busy')).toBeUndefined()
    await feedback.get('button').trigger('click')
    expect(feedback.emitted('retry')).toHaveLength(1)
    feedback.unmount()
  })

  it('reports nonfatal stage failure without claiming the operation stopped', () => {
    const feedback = mount(AsConnectionFeedback, {
      props: { progress: { ...progress, state: 'failed' } }
    })
    expect(feedback.get('[role="alert"]').text()).toBe('Restoring files failed')
    expect(feedback.attributes('aria-busy')).toBe('true')
    expect(feedback.find('button').exists()).toBe(false)
    feedback.unmount()
  })

  it('does not show invalid or negative measurements', () => {
    for (const elapsed_ms of [undefined, NaN, -1, '8400']) {
      const feedback = mount(AsConnectionFeedback, {
        props: { progress: { ...progress, elapsed_ms, ms: elapsed_ms } }
      })
      expect(feedback.find('time').exists()).toBe(false)
      feedback.unmount()
    }
  })
})
