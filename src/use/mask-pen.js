import { ref } from 'vue'

/**
 * Mask pen selection for poster cutouts. Provide from `as-figure` as `mask-pen`;
 * inject in `as-svg` / `as-mask-pen`. Paint strokes batch `selected` updates until
 * `handle_pointerup`.
 */
export const use_mask_pen = () => {
  const active = ref(false)
  const selected = ref(new Set())
  const painting = ref(false)
  const paint_adding = ref(true)
  /** @type {import('vue').Ref<string | null>} */
  const hovered_key = ref(null)
  let paint_batch = false

  const sync_selected = () => {
    selected.value = new Set(selected.value)
  }

  const toggle_path = key => {
    const set = selected.value
    if (set.has(key)) set.delete(key)
    else set.add(key)
    if (!paint_batch) sync_selected()
  }

  const paint_path = key => {
    const already_selected = selected.value.has(key)
    if (paint_adding.value && !already_selected) toggle_path(key)
    else if (!paint_adding.value && already_selected) toggle_path(key)
  }

  const toggle_active = () => {
    active.value = !active.value
  }

  /** @param {string | null} key */
  const handle_pointerdown = key => {
    if (!key) return
    paint_batch = true
    painting.value = true
    paint_adding.value = !selected.value.has(key)
    toggle_path(key)
  }

  /** @param {string | null} key */
  const handle_pointermove = key => {
    hovered_key.value = key
    if (!painting.value || !key) return
    paint_path(key)
  }

  const handle_pointerup = () => {
    if (painting.value) {
      paint_batch = false
      sync_selected()
    }
    painting.value = false
  }

  const clear = () => {
    selected.value = new Set()
  }

  return {
    active,
    selected,
    painting,
    hovered_key,
    toggle_active,
    toggle_path,
    handle_pointerdown,
    handle_pointermove,
    handle_pointerup,
    clear
  }
}
