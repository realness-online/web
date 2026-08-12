import { describe, it, expect } from 'vitest'
import {
  nudge_step,
  GYRO_NUDGE_SECONDS,
  GYRO_NUDGE_SMOOTH
} from '@/utils/gyro-nudge'

describe('nudge_step', () => {
  it('holds at zero when the device is level', () => {
    const { offset, delta } = nudge_step(0, 0, 0)
    expect(offset).toBe(0)
    expect(delta).toBe(0)
  })

  it('eases toward the tilt target, not past it', () => {
    const { offset, delta } = nudge_step(0, 1, 0)
    expect(offset).toBeCloseTo(GYRO_NUDGE_SECONDS * GYRO_NUDGE_SMOOTH)
    expect(delta).toBe(offset)
    expect(offset).toBeLessThan(GYRO_NUDGE_SECONDS)
  })

  it('clamps combined tilt magnitude at a full tilt', () => {
    const full = nudge_step(0, 1, 0)
    const diagonal = nudge_step(0, 1, 1)
    expect(diagonal.offset).toBe(full.offset)
  })

  it('rewinds with a negative delta when the device settles back', () => {
    const { delta } = nudge_step(GYRO_NUDGE_SECONDS, 0, 0)
    expect(delta).toBeLessThan(0)
  })

  it('converges on the target over repeated frames', () => {
    let offset = 0
    for (let i = 0; i < 200; i++) ({ offset } = nudge_step(offset, 0.5, 0))
    expect(offset).toBeCloseTo(0.5 * GYRO_NUDGE_SECONDS, 3)
  })
})
