import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import AsConnectionFeedback from '@/components/chat/as-connection-feedback.vue'

const progress = {
  stage: 'restoring_files',
  state: 'starting',
  elapsed_ms: 8400
}

describe('@/components/chat/as-connection-feedback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('names the stage in plain words and counts every second', async () => {
    const feedback = mount(AsConnectionFeedback, { props: { progress } })
    expect(feedback.get('[role="status"]').text()).toBe(
      'Bringing back your files'
    )
    expect(feedback.get('time').text()).toBe('8 s')
    expect(feedback.get('time').attributes('datetime')).toBe('PT8S')
    expect(feedback.attributes('aria-busy')).toBe('true')
    expect(feedback.find('button').exists()).toBe(false)
    vi.advanceTimersByTime(3000)
    await feedback.vm.$nextTick()
    expect(feedback.get('time').text()).toBe('11 s')
    await feedback.setProps({
      progress: {
        stage: 'starting_host',
        state: 'complete',
        elapsed_ms: 15000
      }
    })
    expect(feedback.get('[role="status"]').text()).toBe('Waking up')
    expect(feedback.get('time').text()).toBe('15 s')
    expect(feedback.text()).not.toContain('reported')
    feedback.unmount()
  })

  it('never invents stages from waiting time, but the clock still moves', async () => {
    const feedback = mount(AsConnectionFeedback, {
      props: { progress: { stage: 'unknown' } }
    })
    vi.advanceTimersByTime(40_000)
    await feedback.vm.$nextTick()
    expect(feedback.get('[role="status"]').text()).toBe('Connecting...')
    expect(feedback.text()).not.toContain('Waking up')
    expect(feedback.get('time').text()).toBe('40 s')
    await feedback.setProps({
      progress: { stage: ['starting_host'], elapsed_ms: 40000 }
    })
    expect(feedback.get('[role="status"]').text()).toBe('Connecting...')
    feedback.unmount()
  })

  it('keeps warning feedback and centered Retry beneath the clock', async () => {
    const feedback = mount(AsConnectionFeedback, {
      props: { progress, problem: 'Actor startup failed' }
    })
    expect(feedback.get('[role="alert"]').text()).toBe('Actor startup failed')
    expect(feedback.element.children[0].tagName).toBe('P')
    expect(feedback.element.children[1].tagName).toBe('TIME')
    expect(feedback.element.children[2].tagName).toBe('BUTTON')
    expect(feedback.attributes('aria-busy')).toBeUndefined()
    vi.advanceTimersByTime(5000)
    await feedback.vm.$nextTick()
    expect(feedback.get('time').text()).toBe('8 s')
    await feedback.get('button').trigger('click')
    expect(feedback.emitted('retry')).toHaveLength(1)
    feedback.unmount()
  })

  it('reports nonfatal stage failure without claiming the operation stopped', () => {
    const feedback = mount(AsConnectionFeedback, {
      props: { progress: { ...progress, state: 'failed' } }
    })
    expect(feedback.get('[role="alert"]').text()).toBe(
      'Bringing back your files failed'
    )
    expect(feedback.attributes('aria-busy')).toBe('true')
    expect(feedback.find('button').exists()).toBe(false)
    feedback.unmount()
  })

  it('treats invalid measurements as zero', () => {
    for (const elapsed_ms of [undefined, NaN, -1, '8400']) {
      const feedback = mount(AsConnectionFeedback, {
        props: { progress: { ...progress, elapsed_ms } }
      })
      expect(feedback.get('time').text()).toBe('0 s')
      feedback.unmount()
    }
  })
})
