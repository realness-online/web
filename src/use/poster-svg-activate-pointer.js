import { ref, toValue } from 'vue'

/** Match `as-svg.vue` scroll guard before pointerup. */
const MOVE_CANCEL_TOUCH_SLIDE_PX = 8

/** Touch + `touch_uses_long_press`: require at least this hold before `on_activate` / slice toggle. */
export const LONG_PRESS_TOGGLE_MS = 500

/** Haptic length (ms) for long-press feedback; not all browsers support Vibration API. */
const VIBRATE_LONG_PRESS_MS = 12

export const vibrate_long_press = () => {
  try {
    // eslint-disable-next-line compat/compat -- optional: vibrate missing on Safari; try/catch no-ops
    navigator.vibrate?.(VIBRATE_LONG_PRESS_MS)
  } catch {
    /* no-op: vibrate unsupported or blocked */
  }
}

/**
 * Pointer -> activate for same-document `<use>` poster duplicates: `on_activate` runs when the
 * touch long-press timer fires (see `LONG_PRESS_TOGGLE_MS`), or on non-touch pointerup, unless
 * touch slid enough to count as scroll (when `touch_uses_long_press` is true) or pan.
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
  let cancelled = false
  let touch_start_x = 0
  let touch_start_y = 0
  /** `0` = no active touch-long-press timing */
  let touch_down_at = 0
  let long_press_timer = null
  /** Monotonic id so a cleared long-press timeout never runs `on_activate` */
  let long_press_sid = 0
  /** Timer already fired `on_activate` for this finger-down */
  let long_press_fired = false

  const long_press_enabled = () => toValue(touch_uses_long_press)

  const clear_long_press_timer = () => {
    // eslint-disable-next-line eqeqeq -- != null: nullish (timeout id or null)
    if (long_press_timer != null) {
      clearTimeout(long_press_timer)
      long_press_timer = null
    }
  }

  /** @param {PointerEvent} event */
  const is_touch_pointer = event => event.pointerType === 'touch'

  /** @param {PointerEvent} event */
  const handle_pointerdown = event => {
    cancelled = false
    if (is_touch_pointer(event) && long_press_enabled()) {
      clear_long_press_timer()
      long_press_sid++
      const token = long_press_sid
      long_press_fired = false
      touch_start_x = event.clientX
      touch_start_y = event.clientY
      touch_down_at = Date.now()
      long_press_timer = setTimeout(() => {
        long_press_timer = null
        if (token !== long_press_sid || cancelled) return
        long_press_fired = true
        on_activate()
        vibrate_long_press()
      }, LONG_PRESS_TOGGLE_MS)
    } else {
      clear_long_press_timer()
      touch_down_at = 0
    }
  }

  /** @param {PointerEvent} event */
  const handle_pointermove = event => {
    if (!is_touch_pointer(event) || !long_press_enabled()) return
    if (long_press_fired) return
    const dx = Math.abs(event.clientX - touch_start_x)
    const dy = Math.abs(event.clientY - touch_start_y)
    if (dx <= MOVE_CANCEL_TOUCH_SLIDE_PX && dy <= MOVE_CANCEL_TOUCH_SLIDE_PX)
      return
    cancelled = true
    held_layer.value = null
    touch_down_at = 0
    clear_long_press_timer()
    long_press_sid++
  }

  /** @param {PointerEvent} event */
  const handle_pointerup = event => {
    if (is_touch_pointer(event) && long_press_enabled()) {
      clear_long_press_timer()
      const down_at = touch_down_at
      touch_down_at = 0
      held_layer.value = null

      if (cancelled) {
        long_press_fired = false
        long_press_sid++
        return
      }

      if (was_pan_gesture?.value) {
        was_pan_gesture.value = false
        long_press_fired = false
        long_press_sid++
        return
      }

      if (!long_press_fired && down_at > 0) {
        const elapsed = Date.now() - down_at
        if (elapsed >= LONG_PRESS_TOGGLE_MS) {
          on_activate()
          vibrate_long_press()
        }
      }
      long_press_fired = false
      long_press_sid++
      return
    }

    clear_long_press_timer()

    if (cancelled) return

    if (was_pan_gesture?.value) {
      was_pan_gesture.value = false
      return
    }
    on_activate()
  }

  const handle_pointerleave = () => {
    cancelled = true
    held_layer.value = null
    touch_down_at = 0
    clear_long_press_timer()
    long_press_fired = false
    long_press_sid++
  }

  return {
    held_layer,
    handle_pointerdown,
    handle_pointermove,
    handle_pointerup,
    handle_pointerleave
  }
}
