import { ref, toValue } from 'vue'

/** Match `as-svg.vue` scroll guard before pointerup. */
const MOVE_CANCEL_TOUCH_SLIDE_PX = 8

/** Touch + `touch_uses_long_press`: require at least this hold before `on_activate` / slice toggle. */
export const LONG_PRESS_TOGGLE_MS = 500

/** Haptic length (ms) for long-press feedback; not all browsers support Vibration API. */
const VIBRATE_LONG_PRESS_MS = 12

/** @type {HTMLLabelElement | null} Kept in the body between long presses */
let haptic_label = null

/**
 * Safari has no Vibration API, but iOS buzzes when a
 * `<input type="checkbox" switch>` toggles - the same feel the footer menu
 * gives. Three details make it fire, and all three are easy to lose:
 *
 * - The click has to go through a `<label for>`; WebKit ignores a scripted
 *   click on the input itself.
 * - The input needs its native appearance. Our global `input { appearance:
 *   none }` strips the switch, and a switch that does not render does not buzz,
 *   so this one opts out with `all: initial`.
 * - It lives in the body, not the head, and stays there.
 */
const toggle_haptic_switch = () => {
  if (typeof document === 'undefined') return
  if (!haptic_label) {
    const id = 'haptic-switch'
    const label = document.createElement('label')
    label.htmlFor = id
    label.ariaHidden = 'true'
    label.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.id = id
    input.tabIndex = -1
    input.style.all = 'initial'
    input.style.appearance = 'auto'
    input.style.display = 'none'
    label.appendChild(input)
    document.body.appendChild(label)
    haptic_label = label
  }
  haptic_label.click()
}

export const vibrate_long_press = () => {
  try {
    // Both, always: Safari can expose `vibrate` and do nothing with it, so the
    // switch toggle is not a fallback - it is the thing that buzzes on iOS.
    // eslint-disable-next-line compat/compat -- optional: vibrate missing on some browsers; try/catch no-ops
    navigator.vibrate?.(VIBRATE_LONG_PRESS_MS)
    toggle_haptic_switch()
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
 * @param {import('vue').MaybeRefOrGetter<boolean>} [opts.is_disabled=false]
 * @param {import('vue').Ref<boolean> | null} [opts.was_pan_gesture=null]
 * @param {((event: PointerEvent) => void) | null} [opts.on_non_touch_pointerdown=null]
 */
export const use_poster_svg_activate_pointer = ({
  on_activate,
  touch_uses_long_press = true,
  is_disabled = false,
  was_pan_gesture = null,
  on_non_touch_pointerdown = null
}) => {
  const held_layer = ref(null)
  let cancelled = false
  let touch_start_x = 0
  let touch_start_y = 0
  /** `0` = no active touch-long-press timing */
  let touch_down_at = 0
  /** @type {ReturnType<typeof setTimeout> | null} */
  let long_press_timer = null
  /** Monotonic id so a cleared long-press timeout never runs `on_activate` */
  let long_press_sid = 0
  /** Timer already fired `on_activate` for this finger-down */
  let long_press_fired = false
  /** Pointer type of the most recent pointerdown, for the contextmenu gate */
  let last_pointer_was_touch = false

  const long_press_enabled = () => toValue(touch_uses_long_press)
  const disabled = () => toValue(is_disabled)

  const clear_long_press_timer = () => {
    // oxlint-disable-next-line eqeqeq -- != null: nullish (timeout id or null)
    if (long_press_timer != null) {
      clearTimeout(long_press_timer)
      long_press_timer = null
    }
  }

  /** @param {PointerEvent} event */
  const is_touch_pointer = event => event.pointerType === 'touch'

  /** @param {PointerEvent} event */
  const handle_pointerdown = event => {
    // Before the disabled guard: the contextmenu gate needs the pointer type
    // even in mask-pen mode, where activation is off but the callout is not.
    last_pointer_was_touch = is_touch_pointer(event)
    if (disabled()) return
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
      on_non_touch_pointerdown?.(event)
    }
  }

  /** @param {PointerEvent} event */
  const handle_pointermove = event => {
    if (disabled()) return
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
    if (disabled()) return
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
    held_layer.value = null
    on_activate()
  }

  /**
   * Block the long-press callout on touch, leave the mouse right-click menu
   * alone. `contextmenu` is one event for both, so it has to be told apart by
   * what the last pointer was - Safari and Firefox do not put `pointerType` on
   * the contextmenu event itself.
   * @param {Event} event
   */
  const handle_contextmenu = event => {
    if (last_pointer_was_touch) event.preventDefault()
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
    handle_pointerleave,
    handle_contextmenu
  }
}
