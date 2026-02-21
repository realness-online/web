/**
 * @fileoverview Performance observer for adaptive animation.
 * The observer is always present—behavior is derived from what it observes.
 * Each observation drives the next interval; no tiers, converges naturally.
 */
import { computed } from 'vue'
import { useFps } from '@vueuse/core'
import { adaptive_enabled } from '@/utils/preference'

export { adaptive_enabled }

const INTERVAL_MIN = 1
const INTERVAL_MAX = 5
const FPS_TARGET = 60
const RUN_RATIO = 0.8
const PAUSE_RATIO = 0.2

const fps = useFps()

const interval = computed(() => {
  const f = Math.min(fps.value, FPS_TARGET)
  const linear = INTERVAL_MIN + (f / FPS_TARGET) * (INTERVAL_MAX - INTERVAL_MIN)
  return Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, linear))
})

export const run_duration = computed(() => interval.value * RUN_RATIO)
export const pause_duration = computed(() => interval.value * PAUSE_RATIO)
export { fps }
