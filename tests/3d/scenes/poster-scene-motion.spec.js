import { describe, it, expect } from 'vite-plus/test'
import {
  smooth_toward,
  nudge_pan,
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

  it('stroke_pulse_opacity oscillates between base and min', () => {
    expect(stroke_pulse_opacity(0, 6, 0.9, 0.1)).toBeCloseTo(0.9, 2)
    expect(stroke_pulse_opacity(3, 6, 0.9, 0.1)).toBeCloseTo(0.1, 2)
    expect(stroke_pulse_opacity(6, 6, 0.9, 0.1)).toBeCloseTo(0.9, 2)
  })
})
