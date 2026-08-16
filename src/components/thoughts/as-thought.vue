<script setup>
  /** @typedef {import('@/types').Statement} Statement */
  import {
    ref,
    computed,
    watch,
    nextTick as tick,
    inject,
    onMounted as mounted,
    onBeforeUnmount as before_unmount
  } from 'vue'
  const props = defineProps({
    thought: {
      /** @type {import('vue').PropType<Statement>} */
      type: Object,
      required: true
    },
    editable: {
      type: Boolean,
      required: false,
      default: false
    }
  })
  const emit = defineEmits(['blurred', 'focused'])
  /** @type {((id: string, content: string) => Promise<void>) | undefined} */
  const update_statement = inject('update_statement')
  /** @type {import('vue').Ref<HTMLParagraphElement | null>} */
  const is_editable = ref(null)
  const thought_text = computed(() => props.thought.statement ?? '')

  /** Desktop-like pointers: read-only shell until deliberate edit, avoids stray single-clicks. */
  const desktop_edit_gate = ref(false)
  const actively_editing = ref(false)

  const DESKTOP_EDIT_MQ = '(hover: hover) and (pointer: fine)'
  /** @type {null | (() => void)} */
  let stop_desktop_mq = null

  mounted(() => {
    const mq = globalThis.matchMedia?.(DESKTOP_EDIT_MQ)
    if (!mq) return
    const sync = () => {
      desktop_edit_gate.value = mq.matches
      if (!mq.matches) actively_editing.value = false
    }
    sync()
    mq.addEventListener('change', sync)
    stop_desktop_mq = () => mq.removeEventListener('change', sync)
  })

  before_unmount(() => {
    stop_desktop_mq?.()
  })

  /**
   * The editor's text is written into the DOM by `set_initial_content`, not by
   * the template. Until that lands, the element is empty for reasons that have
   * nothing to do with what the person typed - so nothing may be saved from it.
   */
  const content_loaded = ref(false)

  const set_initial_content = () => {
    const el = is_editable.value
    if (!el || document.activeElement?.isSameNode(el)) return
    el.textContent = thought_text.value
    content_loaded.value = true
  }

  /**
   * Refill whenever the editor appears or the statement itself changes, so a
   * statement that loads late - or one already saved once - is never edited
   * against text the DOM no longer agrees with.
   */
  watch(
    [() => props.editable, () => props.thought.id, thought_text, is_editable],
    () => {
      content_loaded.value = false
      tick(set_initial_content)
    },
    { immediate: true }
  )

  watch(
    () => [props.editable, props.thought.id],
    () => {
      actively_editing.value = false
    },
    { immediate: true }
  )

  /**
   * @returns {Promise<void>}
   */
  const on_blur = async () => {
    const possibly_changed = is_editable.value?.textContent?.trim()
    if (
      content_loaded.value &&
      thought_text.value !== possibly_changed &&
      update_statement
    )
      await update_statement(props.thought.id, possibly_changed ?? '')
    if (desktop_edit_gate.value) actively_editing.value = false
    emit('blurred', props.thought)
  }

  const on_focus = () => {
    emit('focused', props.thought)
  }

  const focus_editor = () => {
    if (!props.editable) return
    if (desktop_edit_gate.value) {
      actively_editing.value = true
      tick(() => {
        set_initial_content()
        is_editable.value?.focus()
      })
    } else
      tick(() => {
        is_editable.value?.focus()
      })
  }

  /**
   * @param {MouseEvent} e
   */
  const on_wrapper_click = e => {
    if (!props.editable) return
    // The desktop double-click gate protects text from stray clicks. An empty
    // statement has none to protect, and nowhere to advertise the gesture, so
    // one click opens it.
    if (desktop_edit_gate.value && thought_text.value !== '') return
    if (/** @type {Element} */ (e.target).closest?.('[contenteditable="true"]'))
      return
    e.stopPropagation()
    focus_editor()
  }

  /**
   * @param {MouseEvent} e
   */
  const on_wrapper_dblclick = e => {
    if (!props.editable || !desktop_edit_gate.value) return
    e.stopPropagation()
    focus_editor()
  }

  defineExpose({ focus_editor })
</script>

<template>
  <div
    itemscope
    :itemid="thought.id"
    :data-editable="editable || undefined"
    @click="on_wrapper_click"
    @dblclick="on_wrapper_dblclick">
    <p v-if="!editable" itemprop="statement">{{ thought_text }}</p>
    <p v-else-if="desktop_edit_gate && !actively_editing" itemprop="statement">
      {{ thought_text }}
    </p>
    <p
      v-else-if="editable"
      ref="is_editable"
      tabindex="0"
      :spellcheck="true"
      :contenteditable="true"
      itemprop="statement"
      @focus="on_focus"
      @blur.prevent="on_blur" />
  </div>
</template>

<style>
  /* A statement you may edit says so with the I-beam, not with ink: a glyph on
     every editable statement is noise, and once you are in, the browser's own
     caret is the indicator. An emptied statement still needs somewhere to aim,
     which is the min-height on [itemprop='statement']. */
  div[itemscope][data-editable] {
    cursor: text;
  }
</style>
