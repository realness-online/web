import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import as_fps from '@/components/as-fps'
import {
  BASE_DURATION,
  ANIMATION_SPEED_MULTIPLIERS
} from '@/utils/animation-config'

// Controlled refs for pref + useFps
const {
  mock_fps,
  mock_animate,
  mock_speed,
  mock_aspect,
  mock_drama_front,
  mock_drama_back
} = vi.hoisted(() => {
  const watchable = value => ({ value, __v_isRef: true })
  return {
    mock_fps: watchable(60),
    mock_animate: watchable(false),
    mock_speed: watchable('stroll'),
    mock_aspect: watchable('auto'),
    mock_drama_front: watchable(false),
    mock_drama_back: watchable(false)
  }
})

vi.mock('@vueuse/core', () => ({
  useFps: () => mock_fps
}))

vi.mock('@/utils/preference', () => ({
  animate: mock_animate,
  animation_speed: mock_speed,
  aspect_ratio_mode: mock_aspect,
  drama_front: mock_drama_front,
  drama_back: mock_drama_back
}))

const raf_callbacks = []
let next_frame_id = 1

describe('@/components/as-fps.vue', () => {
  let wrapper

  beforeEach(() => {
    mock_fps.value = 60
    mock_animate.value = false
    mock_speed.value = 'stroll'
    mock_aspect.value = 'auto'
    mock_drama_front.value = false
    mock_drama_back.value = false
    raf_callbacks.length = 0
    next_frame_id = 1
    global.requestAnimationFrame = cb => {
      raf_callbacks.push(cb)
      return next_frame_id++
    }
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    wrapper?.unmount()
    delete global.requestAnimationFrame
    delete global.cancelAnimationFrame
  })

  const mount_comp = () => {
    wrapper = shallowMount(as_fps)
    return wrapper
  }

  describe('fps_color', () => {
    it('is accent at or above the acceptable threshold', () => {
      mock_fps.value = 24
      expect(mount_comp().vm.fps_color).toBe('var(--accent)')
    })

    it('is warning between the acceptable and low thresholds', () => {
      mock_fps.value = 20
      expect(mount_comp().vm.fps_color).toBe('var(--warning)')
    })

    it('is emphasis below the low threshold', () => {
      mock_fps.value = 8
      expect(mount_comp().vm.fps_color).toBe('var(--emphasis)')
    })
  })

  describe('animation_status', () => {
    it('reports off when animate is disabled', () => {
      mock_animate.value = false
      expect(mount_comp().vm.animation_status).toBe('anim:off')
    })

    it('reports the current speed when animate is enabled', () => {
      mock_animate.value = true
      mock_speed.value = 'drift'
      expect(mount_comp().vm.animation_status).toBe('anim:drift')
    })
  })

  describe('aspect_ratio', () => {
    it('defaults to auto when the mode is falsy', () => {
      mock_aspect.value = ''
      expect(mount_comp().vm.aspect_ratio).toBe('auto')
    })

    it('uses the configured mode when set', () => {
      mock_aspect.value = 'tall'
      expect(mount_comp().vm.aspect_ratio).toBe('tall')
    })
  })

  describe('max_cycle_time', () => {
    it('scales the base duration by the speed multiplier', () => {
      mock_speed.value = 'sprint'
      expect(mount_comp().vm.max_cycle_time).toBe(
        BASE_DURATION * ANIMATION_SPEED_MULTIPLIERS.sprint
      )
    })

    it('falls back to a 1x multiplier for an unknown speed', () => {
      mock_speed.value = 'not-a-speed'
      expect(mount_comp().vm.max_cycle_time).toBe(BASE_DURATION)
    })
  })

  describe('fps_style', () => {
    it('reflects animate and slice toggles', () => {
      mock_animate.value = true
      mock_aspect.value = 'wide'
      const style = mount_comp().vm.fps_style
      expect(style['--animate']).toBe(1)
      expect(style['--slice']).toBe(1)
      expect(style['--animate-color']).toBe('var(--accent)')
      expect(style['--slice-color']).toBe('var(--sand)')
    })

    it('uses the muted colors when toggles are off', () => {
      const style = mount_comp().vm.fps_style
      expect(style['--animate']).toBe(0)
      expect(style['--slice']).toBe(0)
      expect(style['--animate-color']).toBe('var(--gravel)')
      expect(style['--slice-color']).toBe('var(--rocks)')
    })
  })

  describe('animation time tracking', () => {
    it('schedules the next frame on mount', () => {
      mount_comp()
      expect(raf_callbacks.length).toBe(1)
    })

    it('cancels the frame loop on unmount', () => {
      wrapper = shallowMount(as_fps)
      wrapper.unmount()
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1)
    })

    it('holds animation_time at zero when no poster svg exists', () => {
      const comp = mount_comp()
      // run the scheduled frame once
      raf_callbacks.forEach(cb => cb())
      expect(comp.vm.animation_time).toBe(0)
      expect(raf_callbacks.length).toBe(2)
    })

    it('tracks time against an animating poster svg in view', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('data-animate', '')
      svg.setAttribute('itemtype', '/posters')
      svg.getCurrentTime = () => 540 // 3x BASE_DURATION
      svg.getBoundingClientRect = () => ({ top: 50, bottom: 150 })
      document.body.appendChild(svg)
      mock_speed.value = 'freeze'
      const comp = mount_comp()
      raf_callbacks.forEach(cb => cb())
      // 540 % (180 * 8) = 540 % 1440 = 540
      expect(comp.vm.animation_time).toBe(540)
      document.body.removeChild(svg)
    })
  })
})
