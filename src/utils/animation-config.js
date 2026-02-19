/** @fileoverview Shared animation constants for video export and SVG sync. */

export const FRAMES_PER_SECOND = 3
export const BASE_DURATION = 180

/** Canonical speed names in cycle order (slowest to fastest) */
export const ANIMATION_SPEEDS = [
  'freeze',
  'drift',
  'crawl',
  'amble',
  'stroll',
  'stride',
  'sprint'
]

/** Multiplier for each speed (duration = base * multiplier). Includes legacy aliases. */
export const ANIMATION_SPEED_MULTIPLIERS = {
  sprint: 0.125,
  stride: 0.25,
  stroll: 0.5,
  amble: 1,
  crawl: 2,
  drift: 4,
  freeze: 8,
  fastest: 0.125,
  faster: 0.25,
  fast: 0.5,
  normal: 1,
  slow: 2,
  very_slow: 4,
  glacial: 8
}

/** Map legacy names to canonical for cycling */
export const ANIMATION_SPEED_LEGACY = {
  fastest: 'sprint',
  faster: 'stride',
  fast: 'stroll',
  normal: 'amble',
  slow: 'crawl',
  very_slow: 'drift',
  glacial: 'freeze'
}

export const DEFAULT_ANIMATION_SPEED = 'amble'

const SHORTEST_SYNC = 18
const SHORT_SYNC = 30
const MEDIUM_SYNC = 60
const LONG_SYNC = 90

/** Divisors of BASE_DURATION, multiples of 1/FRAMES_PER_SECOND for frame-aligned sync */
export const SYNC_DURATIONS = [
  SHORTEST_SYNC,
  SHORT_SYNC,
  MEDIUM_SYNC,
  LONG_SYNC,
  BASE_DURATION
]
