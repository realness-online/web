# Adaptive Animation Plan

## Philosophy

There is always an observer in physics. The performance observer is foundational—not optional. The app runs with an observer from the start. Behavior is derived from what it observes.

## Architecture

Three layers:

1. **Observation** – FPS / frame deltas, always running
2. **Derivation** – interval, run_duration, pause_duration from observations
3. **Behavior** – 80/20 rhythm uses derived values

## 80/20 Rhythm

- **80%** of interval: animation running
- **20%** of interval: pause → setCurrentTime(current + pause_duration) → unpause

Single tuning parameter: interval length (derived from FPS, not user-set).

| FPS   | Interval | Run  | Pause |
| ----- | -------- | ---- | ----- |
| < 24  | 2s       | 1.6s | 0.4s  |
| 24–50 | 3s       | 2.4s | 0.6s  |
| > 50  | 5s       | 4s   | 1s    |

## Component Validation

Guard at a higher level via props, not scattered if-statements:

- Parent (as-svg) passes `:svg="trigger"` to as-animation
- Prop validator: `v instanceof SVGSVGElement && document.contains(v)`
- Parent uses `v-if="vector && trigger"` so as-animation only mounts when valid
- No guards inside as-animation—it receives a valid SVG or doesn't exist

## Implementation Steps

1. **Create `use/animation-performance.js`**

   - Uses `useFps()` from VueUse (shared observer)
   - Computes `interval` from FPS (throttled, e.g. 500ms)
   - Exports `run_duration`, `pause_duration` (80/20 of interval)
   - Always runs—observer is constant

2. **Refactor as-svg**

   - Add `v-if="vector && trigger"` to as-animation
   - Pass `:svg="trigger"` prop

3. **Refactor as-animation**

   - Add `svg` prop with validator
   - Remove animation_group ref and closest('svg')—use props.svg
   - Add `effective_paused = props.paused || adaptive_paused`
   - watchEffect uses effective_paused
   - rAF loop: run for run_duration → pause → setCurrentTime → unpause after pause_duration
   - Loop only runs when `!props.paused` and svg valid
   - Cleanup: cancel rAF on unmount, stop when props.paused flips

4. **Wire fps.vue** (optional)
   - fps.vue already uses useFps—could share the composable or keep separate
   - useFps is singleton-ish; multiple callers share the same measurement

## Gotchas

- **watchEffect vs adaptive_paused**: Use `effective_paused = props.paused || adaptive_paused` so watchEffect doesn't unpause during our 20% window
- **Cleanup**: Cancel rAF in onUnmounted; stop loop when props.paused becomes true
- **Arrow key scrubbing**: Resetting cycle on scrub is optional—avoid pause immediately after user scrub
- **Export/clone**: as-animation won't run in cloned SVG—no change needed
- **Props.paused flips**: When user turns off, stop loop; when back on, restart from run phase
- **No setTimeout**: Use rAF + performance.now() for timing

## Files

- `src/use/animation-performance.js` – new composable
- `src/use/poster.js` – added `is_svg_valid` (module-level for defineProps validator)
- `src/components/posters/as-animation.vue` – refactor
- `src/components/posters/as-svg.vue` – pass svg, conditional render
- `src/App.vue` – imports animation-performance so observer runs from app start
