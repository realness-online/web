import { onMounted as mounted, onUnmounted as unmounted } from 'vue'

/** Suppress touch callouts on app controls without cancelling their gestures. */
export const use_touch_callout = () => {
  let last_pointer_was_touch = false

  const record_pointer = event => {
    last_pointer_was_touch = event.pointerType === 'touch'
  }
  const on_contextmenu = event => {
    if (!last_pointer_was_touch) return
    const { target } = event
    if (!(target instanceof Element)) return
    // Text entry keeps native selection, copy, and paste.
    if (target.closest('[contenteditable="true"], textarea')) return
    const input = target.closest('input')
    if (
      input &&
      !['checkbox', 'radio', 'file', 'button', 'submit', 'range'].includes(
        input.type
      )
    )
      return
    event.preventDefault()
  }

  mounted(() => {
    window.addEventListener('pointerdown', record_pointer, {
      capture: true,
      passive: true
    })
    window.addEventListener('contextmenu', on_contextmenu, true)
  })
  unmounted(() => {
    window.removeEventListener('pointerdown', record_pointer, true)
    window.removeEventListener('contextmenu', on_contextmenu, true)
  })
}
