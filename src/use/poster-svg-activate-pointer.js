import { ref, toValue } from 'vue'

const HOLD_MS = 250
const TOUCH_TOGGLE_HOLD_MS = 450
const MOVE_CANCEL_TOUCH_TOGGLE_PX = 8

/**
 * Same pointer → activate sequence as `as-svg` (hold timers, touch long-press, pan skip),
 * but calls `on_activate` instead of toggling local `use_meet` + emit.
 * Used by `as-figure` when rendering a same-document `<use>` duplicate so pointer
 * behavior matches `as-svg`.
 *
 * @param {object} opts
 * @param {() => void} opts.on_activate
 * @param {import('vue').MaybeRefOrGetter<boolean>} [opts.touch_uses_long_press=true]
 */
export const use_poster_svg_activate_pointer = ({
  on_activate,
  touch_uses_long_press = true
}) => {
  const held_layer = ref(null)
  /** Duplicate `<use>` rows do not register for delegated pan; keep false like a non-pan pointerup. */
  const was_pan_gesture = ref(false)
  let hold_timer = null
  let was_hold = false
  let cancelled = false
  let touch_toggle_timer = null
  let touch_toggle_fired = false
  let touch_start_x = 0
  let touch_start_y = 0

  const long_press_enabled = () => toValue(touch_uses_long_press)

  /** @param {PointerEvent} event */
  const is_touch_pointer = event => event.pointerType === 'touch'

  const layer_from_target = _el => null

  /** @param {PointerEvent} event */
  const handle_pointerdown = event => {
    was_hold = false
    cancelled = false
    if (hold_timer) clearTimeout(hold_timer)
    hold_timer = null
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    touch_toggle_fired = false

    const layer = layer_from_target(event.target)

    if (is_touch_pointer(event) && long_press_enabled()) {
      touch_start_x = event.clientX
      touch_start_y = event.clientY
      hold_timer = setTimeout(() => {
        hold_timer = null
        was_hold = true
        held_layer.value = layer
      }, HOLD_MS)
      touch_toggle_timer = setTimeout(() => {
        touch_toggle_timer = null
        if (cancelled) return
        touch_toggle_fired = true
        held_layer.value = null
        was_hold = false
        on_activate()
      }, TOUCH_TOGGLE_HOLD_MS)
      return
    }

    hold_timer = setTimeout(() => {
      hold_timer = null
      was_hold = true
      held_layer.value = layer
    }, HOLD_MS)
  }

  /** @param {PointerEvent} event */
  const handle_pointermove = event => {
    if (!is_touch_pointer(event) || !long_press_enabled()) return
    if (!touch_toggle_timer && !hold_timer) return
    const dx = Math.abs(event.clientX - touch_start_x)
    const dy = Math.abs(event.clientY - touch_start_y)
    if (dx <= MOVE_CANCEL_TOUCH_TOGGLE_PX && dy <= MOVE_CANCEL_TOUCH_TOGGLE_PX)
      return
    cancelled = true
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    if (hold_timer) {
      clearTimeout(hold_timer)
      hold_timer = null
    }
    held_layer.value = null
    was_hold = false
  }

  /** @param {PointerEvent} event */
  const handle_pointerup = event => {
    if (hold_timer) {
      clearTimeout(hold_timer)
      hold_timer = null
    }
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    if (cancelled) return

    if (is_touch_pointer(event) && long_press_enabled()) {
      if (was_pan_gesture?.value) {
        was_pan_gesture.value = false
        held_layer.value = null
        was_hold = false
        return
      }
      if (touch_toggle_fired) {
        touch_toggle_fired = false
        held_layer.value = null
        was_hold = false
        return
      }
      held_layer.value = null
      was_hold = false
      return
    }

    if (was_hold) {
      held_layer.value = null
      was_hold = false
      return
    }
    if (was_pan_gesture?.value) {
      was_pan_gesture.value = false
      return
    }
    on_activate()
  }

  const handle_pointerleave = () => {
    if (hold_timer) clearTimeout(hold_timer)
    hold_timer = null
    if (touch_toggle_timer) {
      clearTimeout(touch_toggle_timer)
      touch_toggle_timer = null
    }
    cancelled = true
    held_layer.value = null
  }

  return {
    held_layer,
    handle_pointerdown,
    handle_pointermove,
    handle_pointerup,
    handle_pointerleave
  }
}
