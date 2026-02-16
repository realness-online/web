import { ref, watch } from 'vue'

const GESTURE_THRESHOLD = 8
const RUBBER_RESISTANCE = 0.25
const MAX_OVERFLOW_PX = 80

/**
 * Single delegated touch handler for pan gestures. Touch events provide more
 * natural feel on mobile than pointer events. One container listener avoids
 * N per-poster listeners.
 * @param {import('vue').Ref<HTMLElement|null>} container_ref
 * @returns {{ register: (element_ref: import('vue').Ref, opts: { get_can_pan: () => boolean, get_max_pan_px: () => number }) => { pan_offset: import('vue').Ref, unregister: () => void } }}
 */
export const use_delegated_pan = container_ref => {
  const pan_targets = new Map()
  let current_gesture = null
  let listeners_container = null

  const find_target = element => {
    const svg = element.closest?.('svg[itemtype="/posters"]')
    if (!svg || !pan_targets.has(svg)) return null
    return svg
  }

  const on_touch_start = event => {
    const el = find_target(event.target)
    if (!el) return
    const reg = pan_targets.get(el)
    if (!reg || !reg.get_can_pan() || !event.touches.length) return
    const [touch] = event.touches
    reg.panning.value = true
    current_gesture = {
      element: el,
      reg,
      touch_id: touch.identifier,
      start_x: touch.clientX,
      start_y: touch.clientY,
      pan_start_offset: reg.pan_offset.value,
      max_pan_px: reg.get_max_pan_px(),
      gesture_decided: false,
      gesture_is_pan: false
    }
  }

  const on_touch_move = event => {
    if (!current_gesture || !event.touches.length) return
    let touch = null
    for (let i = 0; i < event.touches.length; i++)
      if (event.touches[i].identifier === current_gesture.touch_id) {
        touch = event.touches[i]
        break
      }
    if (!touch) return
    const { reg } = current_gesture
    const delta_x = touch.clientX - current_gesture.start_x
    const delta_y = touch.clientY - current_gesture.start_y
    if (!current_gesture.gesture_decided) {
      const abs_x = Math.abs(delta_x)
      const abs_y = Math.abs(delta_y)
      if (abs_x > GESTURE_THRESHOLD || abs_y > GESTURE_THRESHOLD) {
        current_gesture.gesture_decided = true
        current_gesture.gesture_is_pan = abs_x > abs_y
      }
    }
    if (!current_gesture.gesture_is_pan) return
    event.preventDefault()
    const max = current_gesture.max_pan_px
    const raw = current_gesture.pan_start_offset + delta_x
    let value
    if (raw > max) {
      const overflow = Math.min(
        (raw - max) * RUBBER_RESISTANCE,
        MAX_OVERFLOW_PX
      )
      value = max + overflow
    } else if (raw < -max) {
      const overflow = Math.min(
        (-max - raw) * RUBBER_RESISTANCE,
        MAX_OVERFLOW_PX
      )
      value = -max - overflow
    } else value = raw
    reg.pan_offset.value = value
  }

  const on_touch_end = event => {
    if (!current_gesture) return
    let still_active = false
    for (let i = 0; i < event.touches.length; i++)
      if (event.touches[i].identifier === current_gesture.touch_id) {
        still_active = true
        break
      }
    if (still_active) return
    const { reg } = current_gesture
    reg.panning.value = false
    if (current_gesture.gesture_is_pan) {
      const max = current_gesture.max_pan_px
      reg.pan_offset.value = Math.max(-max, Math.min(max, reg.pan_offset.value))
    }
    current_gesture = null
  }

  const add_listeners = container => {
    if (!container || listeners_container) return
    container.addEventListener('touchstart', on_touch_start, { passive: true })
    container.addEventListener('touchmove', on_touch_move, { passive: false })
    container.addEventListener('touchend', on_touch_end, { passive: true })
    container.addEventListener('touchcancel', on_touch_end, { passive: true })
    listeners_container = container
  }

  const remove_listeners = () => {
    if (!listeners_container) return
    listeners_container.removeEventListener('touchstart', on_touch_start)
    listeners_container.removeEventListener('touchmove', on_touch_move)
    listeners_container.removeEventListener('touchend', on_touch_end)
    listeners_container.removeEventListener('touchcancel', on_touch_end)
    listeners_container = null
  }

  watch(
    container_ref,
    (container, _, on_cleanup) => {
      remove_listeners()
      if (container) add_listeners(container)
      on_cleanup(remove_listeners)
    },
    { immediate: true }
  )

  const register = (element_ref, { get_can_pan, get_max_pan_px }) => {
    const pan_offset = ref(0)
    const panning = ref(false)
    const cleanup = watch(
      element_ref,
      (el, old_el) => {
        if (current_gesture?.element === old_el) current_gesture = null
        if (old_el) pan_targets.delete(old_el)
        if (el)
          pan_targets.set(el, {
            pan_offset,
            panning,
            get_can_pan,
            get_max_pan_px
          })
      },
      { immediate: true }
    )
    return {
      pan_offset,
      panning,
      unregister: () => {
        cleanup()
        if (element_ref.value) pan_targets.delete(element_ref.value)
      }
    }
  }

  return { register }
}
