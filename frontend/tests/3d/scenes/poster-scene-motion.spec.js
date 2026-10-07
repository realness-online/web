import { describe, it, expect } from 'vite-plus/test'
import {
  smooth_toward,
  nudge_pan,
  sample_keyframes,
  stroke_pulse_opacity
} from '@/3d/scenes/poster-scene-motion.js'

describe('poster-scene-motion', () => {
  it('smooth_toward settles toward target over time', () => {
    let current = 0
    const target = 10
    const delta_s = 1 / 60
    for (let i = 0; i < 120; i++)
      current = smooth_toward(current, target, 10, delta_s)
    expect(current).toBeCloseTo(target, 2)
  })

  it('smooth_toward snaps when rate is zero', () => {
    expect(smooth_toward(3, 9, 0, 1 / 60)).toBe(9)
  })

  it('nudge_pan keeps target and current aligned', () => {
    const pan = {
      target: { x: 1, y: 2 },
      current: { x: 1, y: 2 }
    }
    nudge_pan(pan, 0.5, -0.25)
    expect(pan.target.x).toBe(1.5)
    expect(pan.current.y).toBe(1.75)
  })

  it('sample_keyframes interpolates linearly between keyframes', () => {
    const frames = [
      { at: 0, value: 0.9 },
      { at: 0.25, value: 0.75 },
      { at: 0.5, value: 0.9 },
      { at: 0.75, value: 0.21 },
      { at: 1, value: 0.9 }
    ]

    expect(sample_keyframes(0, 6, frames)).toBeCloseTo(0.9, 4)
    expect(sample_keyframes(1.5, 6, frames)).toBeCloseTo(0.75, 4)
    expect(sample_keyframes(4.5, 6, frames)).toBeCloseTo(0.21, 4)
    expect(sample_keyframes(0.75, 6, frames)).toBeCloseTo(0.825, 4)
  })

  it('sample_keyframes loops on the period and handles negative time', () => {
    const frames = [
      { at: 0, value: 0 },
      { at: 0.5, value: 1 },
      { at: 1, value: 0 }
    ]

    expect(sample_keyframes(9, 6, frames)).toBeCloseTo(1, 4)
    expect(sample_keyframes(-3, 6, frames)).toBeCloseTo(1, 4)
  })

  it('sample_keyframes holds still without a period or a second keyframe', () => {
    const frames = [
      { at: 0, value: 0.4 },
      { at: 1, value: 0.9 }
    ]

    expect(sample_keyframes(2, 0, frames)).toBe(0.4)
    expect(sample_keyframes(2, 6, frames.slice(0, 1))).toBe(0.4)
  })

  it('stroke_pulse_opacity oscillates between base and min', () => {
    expect(stroke_pulse_opacity(0, 6, 0.9, 0.1)).toBeCloseTo(0.9, 2)
    expect(stroke_pulse_opacity(3, 6, 0.9, 0.1)).toBeCloseTo(0.1, 2)
    expect(stroke_pulse_opacity(6, 6, 0.9, 0.1)).toBeCloseTo(0.9, 2)
  })
})
