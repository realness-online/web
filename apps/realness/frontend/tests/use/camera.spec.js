import { describe, it, expect, beforeEach } from 'vite-plus/test'
import {
  camera_next,
  camera_reach,
  report_camera_reach,
  CAMERA_STEP,
  CAMERA_LIMIT,
  CAMERA_RAMP_MAX
} from '@/use/camera'

const press = (over = {}) =>
  camera_next({ at: 0, direction: 1, ramp: 1, held: false, ...over })

describe('@/use/camera', () => {
  it('moves one step from a standing start', () => {
    expect(press().at).toBeCloseTo(CAMERA_STEP)
    expect(press().ramp).toBe(1)
  })

  it('goes the other way for -1', () => {
    expect(press({ direction: -1 }).at).toBeCloseTo(-CAMERA_STEP)
  })

  it('gains speed while the key is held', () => {
    const first = press({ held: true })
    const second = press({ at: first.at, ramp: first.ramp, held: true })
    expect(second.ramp).toBeGreaterThan(first.ramp)
    expect(second.at - first.at).toBeGreaterThan(first.at)
  })

  it('stops gaining at the cap', () => {
    let ramp = 1
    for (let i = 0; i < 40; i++) ramp = press({ ramp, held: true }).ramp
    expect(ramp).toBe(CAMERA_RAMP_MAX)
  })

  it('drops back to walking pace when the key is let go', () => {
    expect(press({ ramp: CAMERA_RAMP_MAX, held: false }).ramp).toBe(1)
  })

  it('never travels past the limit', () => {
    expect(press({ at: CAMERA_LIMIT, direction: 1 }).at).toBe(CAMERA_LIMIT)
    expect(press({ at: -CAMERA_LIMIT, direction: -1 }).at).toBe(-CAMERA_LIMIT)
  })
})

describe('@/use/camera reach', () => {
  beforeEach(() => {
    report_camera_reach('a', null)
    report_camera_reach('b', null)
  })

  it('lets the camera run to its limit when no poster has reported', () => {
    expect(camera_reach.value).toEqual({
      up: CAMERA_LIMIT,
      down: CAMERA_LIMIT
    })
  })

  it('stops where the most generous poster on screen stops', () => {
    report_camera_reach('a', { up: 0.2, down: 0.2 })
    report_camera_reach('b', { up: 0.5, down: 0.1 })
    expect(camera_reach.value).toEqual({ up: 0.5, down: 0.2 })
  })

  it('forgets a poster that has gone', () => {
    report_camera_reach('a', { up: 0.5, down: 0.5 })
    report_camera_reach('a', null)
    expect(camera_reach.value.up).toBe(CAMERA_LIMIT)
  })

  it('does not count past what the posters can use', () => {
    const reach = { up: 0.1, down: 0.1 }
    let at = 0
    for (let i = 0; i < 10; i++)
      at = camera_next({ at, direction: 1, ramp: 1, held: false, reach }).at
    expect(at).toBeCloseTo(0.1)
  })
})
