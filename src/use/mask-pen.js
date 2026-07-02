import { ref, computed } from 'vue'

/**
 * @typedef {object} Subject
 * @property {string} id - local id; the persisted itemid is `${poster}/subjects/${id}`
 * @property {string} name
 * @property {Set<string>} keys - geology cell references, `"<layer>:<index>"`
 */

let next_subject_id = 0

const HUE_STEP = 47
const HUE_WHEEL = 360
/** Stable-ish hue per subject index, shared by the toolbar chip and the overlay. */
export const subject_hue = index => (index * HUE_STEP) % HUE_WHEEL

/**
 * Mask pen for authoring poster subjects: named groups of geology cells. Provide from
 * `as-figure` as `mask-pen`; inject in `as-svg` / `as-mask-pen`. Painting toggles cells into
 * the active subject (batched until `handle_pointerup`); each cell is owned by at most one
 * subject. `selected` is a view of the active subject so simple consumers keep working.
 */
export const use_mask_pen = () => {
  const active = ref(false)
  /** @type {import('vue').Ref<Subject[]>} */
  const subjects = ref([])
  /** @type {import('vue').Ref<string | null>} */
  const active_subject_id = ref(null)
  const painting = ref(false)
  const paint_adding = ref(true)
  /** @type {import('vue').Ref<string | null>} */
  const hovered_key = ref(null)
  let paint_batch = false

  const active_subject = computed(
    () => subjects.value.find(s => s.id === active_subject_id.value) ?? null
  )

  /** The active subject's cells — a read view for selection-aware consumers. */
  const selected = computed(() => active_subject.value?.keys ?? new Set())

  const sync = () => {
    subjects.value = [...subjects.value]
  }

  /** @param {string} [name] */
  const add_subject = (name = '') => {
    const id = `${Date.now()}-${next_subject_id++}`
    /** @type {Subject} */
    const subject = { id, name, keys: new Set() }
    subjects.value = [...subjects.value, subject]
    active_subject_id.value = id
    return subject
  }

  /** @param {string} id */
  const select_subject = id => {
    active_subject_id.value = id
  }

  /** @param {string} id @param {string} name */
  const rename_subject = (id, name) => {
    const subject = subjects.value.find(s => s.id === id)
    if (!subject) return
    subject.name = name
    sync()
  }

  /** @param {string} id */
  const remove_subject = id => {
    subjects.value = subjects.value.filter(s => s.id !== id)
    if (active_subject_id.value === id)
      active_subject_id.value = subjects.value[0]?.id ?? null
  }

  const ensure_active_subject = () => active_subject.value ?? add_subject('')

  /** @param {string} key */
  const owner_of = key => subjects.value.find(s => s.keys.has(key)) ?? null

  /** @param {string} key */
  const toggle_path = key => {
    const subject = ensure_active_subject()
    if (subject.keys.has(key)) subject.keys.delete(key)
    else {
      // Exclusive ownership: a cell belongs to one subject at a time.
      const other = owner_of(key)
      if (other && other !== subject) other.keys.delete(key)
      subject.keys.add(key)
    }
    if (!paint_batch) sync()
  }

  /** Union a set of cells into the active subject (exclusive), for grow-selection. */
  const add_members = keys => {
    const subject = ensure_active_subject()
    for (const key of keys) {
      if (subject.keys.has(key)) continue
      const other = owner_of(key)
      if (other && other !== subject) other.keys.delete(key)
      subject.keys.add(key)
    }
    sync()
  }

  /** Remove a set of cells from the active subject, for grow-unselect. */
  const remove_members = keys => {
    const subject = active_subject.value
    if (!subject) return
    for (const key of keys) subject.keys.delete(key)
    sync()
  }

  /** @param {string} key */
  const paint_path = key => {
    const subject = ensure_active_subject()
    const already_selected = subject.keys.has(key)
    if (paint_adding.value && !already_selected) toggle_path(key)
    else if (!paint_adding.value && already_selected) toggle_path(key)
  }

  const toggle_active = () => {
    active.value = !active.value
    if (active.value && subjects.value.length === 0) add_subject('')
  }

  /** @param {string | null} key */
  const handle_pointerdown = key => {
    if (!key) return
    const subject = ensure_active_subject()
    paint_batch = true
    painting.value = true
    paint_adding.value = !subject.keys.has(key)
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
      sync()
    }
    painting.value = false
  }

  /** Clear the active subject's cells. */
  const clear = () => {
    const subject = active_subject.value
    if (!subject) return
    subject.keys = new Set()
    sync()
  }

  return {
    active,
    subjects,
    active_subject_id,
    active_subject,
    selected,
    painting,
    hovered_key,
    owner_of,
    add_subject,
    select_subject,
    rename_subject,
    remove_subject,
    toggle_active,
    toggle_path,
    add_members,
    remove_members,
    handle_pointerdown,
    handle_pointermove,
    handle_pointerup,
    clear
  }
}
