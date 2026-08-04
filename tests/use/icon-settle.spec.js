import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { use_icon_settle } from '@/use/icon-settle'

/** @param {string[]} classes Classes on the part that finished */
const animation_end = (name, classes = []) => {
  const target = document.createElement('div')
  for (const part of classes) target.classList.add(part)
  return { animationName: name, target }
}

describe('@/use/icon-settle', () => {
  /** @type {Function[]} */
  let frames

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', callback => frames.push(callback))
  })

  afterEach(() => vi.unstubAllGlobals())

  const next_frame = () => frames.splice(0).forEach(callback => callback())

  describe('leaving after a hover', () => {
    it('settles on the next frame', () => {
      const icon = use_icon_settle({ animation: 'flourish' })
      icon.enter()
      icon.leave()
      expect(icon.settling.value).toBe(false)
      next_frame()
      expect(icon.settling.value).toBe(true)
    })

    it('does nothing when the pointer never entered', () => {
      const icon = use_icon_settle({ animation: 'flourish' })
      icon.leave()
      next_frame()
      expect(icon.settling.value).toBe(false)
    })

    it('drops the flourish when the pointer comes back', () => {
      const icon = use_icon_settle({ animation: 'flourish' })
      icon.enter()
      icon.leave()
      next_frame()
      icon.enter()
      expect(icon.settling.value).toBe(false)
    })

    it('replays rather than joining a flourish already running', () => {
      const icon = use_icon_settle({ animation: 'flourish' })
      icon.enter()
      icon.leave()
      next_frame()
      icon.enter()
      icon.leave()
      // cleared immediately, so the animation restarts from the top
      expect(icon.settling.value).toBe(false)
      next_frame()
      expect(icon.settling.value).toBe(true)
    })

    it('clears a flourish a stale frame started while hovered', () => {
      const icon = use_icon_settle({ animation: 'flourish' })
      icon.enter()
      icon.leave()
      // pointer returns before the queued frame runs, so the flourish starts
      // even though the icon is hovered again
      icon.enter()
      next_frame()
      expect(icon.settling.value).toBe(true)

      icon.leave()
      expect(icon.settling.value).toBe(false)
      next_frame()
      expect(icon.settling.value).toBe(true)
    })
  })

  describe('ending the settle', () => {
    const settled = options => {
      const icon = use_icon_settle(options)
      icon.enter()
      icon.leave()
      next_frame()
      return icon
    }

    it('ends on the animation it was told to wait for', () => {
      const icon = settled({ animation: 'flourish' })
      icon.end(animation_end('flourish'))
      expect(icon.settling.value).toBe(false)
    })

    it('ignores any other animation finishing', () => {
      const icon = settled({ animation: 'flourish' })
      icon.end(animation_end('pulse'))
      expect(icon.settling.value).toBe(true)
    })

    it('waits for the named part when several share the keyframe', () => {
      const icon = settled({ animation: 'flourish', part: 'ball' })
      icon.end(animation_end('flourish', ['trail']))
      expect(icon.settling.value).toBe(true)
      icon.end(animation_end('flourish', ['ball']))
      expect(icon.settling.value).toBe(false)
    })
  })
})
